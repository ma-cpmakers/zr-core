// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Breadcrumb di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';

  /* ---------- Breadcrumb: percorso delle pagine pubbliche ---------- */
  function Breadcrumb(p) {
    /* senza items non c'è percorso: niente voci d'esempio, che una pagina senza percorso suo mostrerebbe come vere (richiesta 116) */
    var items = p.items || [];
    if (!items.length) return null;
    return h('nav', { className: cx('zr-breadcrumb', p.className), 'aria-label': p.label || 'Percorso' },
      h('ol', null, items.map(function (it, i) {
        var last = i === items.length - 1;
        return h('li', { key: i },
          last || !it.href ? h('span', { 'aria-current': last ? 'page' : undefined }, it.label) : h('a', { href: it.href }, it.label),
          last ? null : h(Icon, { name: 'chevron', size: 14 }));
      })));
  }

export { Breadcrumb };
