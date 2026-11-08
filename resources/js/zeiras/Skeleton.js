// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Skeleton di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function Skeleton(p) {
    var lines = p.lines || 3;
    return h('div', { className: 'zr-skel', 'aria-hidden': true }, Array.from({ length: lines }).map(function (_, i) {
      return h('span', { key: i, style: { width: i === lines - 1 ? '60%' : '100%' } });
    }));
  }

export { Skeleton };
