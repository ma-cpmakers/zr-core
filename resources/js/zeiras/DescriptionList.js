// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DescriptionList di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function DescriptionList(p) {
    return h('dl', { className: 'zr-dl' }, (p.items || []).map(function (it) { return h('div', { key: it.label }, h('dt', null, it.label), h('dd', null, it.value)); }));
  }

export { DescriptionList };
