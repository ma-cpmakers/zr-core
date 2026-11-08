// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Icon di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { PATHS } from './interni/PATHS';

  function Icon(p) {
    var size = p.size || 20;
    return h('svg', {
      className: cx('zr-icon', p.className), width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: p.name === 'more' ? 3 : 1.75,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false'
    }, h('path', { d: PATHS[p.name] || PATHS.more }));
  }

export { Icon };
