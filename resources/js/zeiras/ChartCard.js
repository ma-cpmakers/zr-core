// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ChartCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';

  function ChartCard(p) {
    return h('section', { className: cx('zr-panel', p.className) },
      h('header', { className: 'zr-panel-head' }, h('div', null, h(p.headingLevel === 3 ? 'h3' : p.headingLevel === 4 ? 'h4' : 'h2', null, p.title), p.subtitle ? h('p', null, p.subtitle) : null), p.actions ? h('div', { className: 'zr-panel-actions' }, p.actions) : null),
      h('div', { className: 'zr-panel-body' }, p.children));
  }

export { ChartCard };
