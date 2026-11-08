// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È SectionHeading di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';

  function SectionHeading(p) {
    return h('div', { className: cx('zr-sec-head', p.align === 'center' && 'is-center', p.level === 1 && 'is-page') },
      p.overline ? h('span', { className: 'zr-overline' }, p.overline) : null,
      h(p.level === 1 ? 'h1' : 'h2', { className: 'zr-sec-title' }, p.title),
      p.subtitle ? h('p', { className: 'zr-sec-sub' }, p.subtitle) : null);
  }

export { SectionHeading };
