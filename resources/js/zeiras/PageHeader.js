// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È PageHeader di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { countParts } from './interni/countParts';
import { fmtNum } from './interni/fmtNum';

  function PageHeader(p) {
    return h('div', { className: 'zr-page-head' },
      h('div', { className: 'zr-page-head-text' },
        p.overline ? h('span', { className: 'zr-overline' }, p.overline) : null,
        h('h1', null, p.title, p.count != null ? countParts(fmtNum(p.count), 'zr-count zr-page-count', p.countLabel) : null),
        p.subtitle ? h('p', null, p.subtitle) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

export { PageHeader };
