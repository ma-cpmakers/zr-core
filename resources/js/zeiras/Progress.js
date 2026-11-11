// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Progress di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function Progress(p) {
    var pct = Math.max(0, Math.min(100, Math.round((p.value / (p.max || 100)) * 100)));
    var tone = p.tone || (pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'pine');
    return h('div', { className: 'zr-progress' },
      p.label ? h('div', { className: 'zr-progress-top' }, h('span', null, p.label), h('span', null, p.valueLabel || pct + '%')) : null,
      h('div', { className: 'zr-progress-track', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.label },
        h('div', { className: 'zr-progress-bar zr-bg-' + tone, style: { width: pct + '%' } })));
  }

export { Progress };
