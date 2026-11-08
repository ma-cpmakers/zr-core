// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Logo di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';

  /* Logo: simbolo a tre blocchi (pine, pine-soft, citrus) + nome Zeiras. Colori dai token: cambia da solo nel tema scuro. */
  function Logo(p) {
    p = p || {};
    var size = p.size || 24;
    var mark = h('svg', { className: 'zr-logo-mark', width: Math.round(size * 68 / 64), height: size, viewBox: '0 0 68 64', 'aria-hidden': p.wordmark === false ? undefined : 'true', role: p.wordmark === false ? 'img' : undefined, 'aria-label': p.wordmark === false ? 'Zeiras' : undefined, focusable: 'false' },
      h('rect', { className: 'zr-logo-b1', x: 0, y: 0, width: 34, height: 64, rx: 6 }),
      h('rect', { className: 'zr-logo-b2', x: 38.5, y: 9, width: 29.5, height: 18.5, rx: 5 }),
      h('rect', { className: 'zr-logo-b3', x: 38.5, y: 32, width: 29.5, height: 32, rx: 6 }));
    if (p.wordmark === false) return h('span', { className: cx('zr-logo', p.className) }, mark);
    return h('span', { className: cx('zr-logo', p.className) }, mark, h('span', { className: 'zr-wordmark' }, 'Zeiras'));
  }

export { Logo };
