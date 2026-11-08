// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È EmptyState di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';

  function EmptyState(p) {
    return h('div', { className: cx('zr-empty', p.compact && 'is-compact') },
      h('span', { className: cx('zr-iconbox', 'zr-label-' + (p.tone || 'pine')) }, h(Icon, { name: p.icon || 'folder', size: 22 })),
      h(p.headingLevel === 2 ? 'h2' : p.headingLevel === 4 ? 'h4' : 'h3', { className: 'zr-empty-title' }, p.title), /* il livello del titolo lo dice la pagina: h3 se non lo dice (richiesta 16) */
      p.text ? h('p', null, p.text) : null,
      p.action || null);
  }

export { EmptyState };
