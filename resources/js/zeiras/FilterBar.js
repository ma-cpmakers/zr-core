// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È FilterBar di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useId } from './AppShell';

  function FilterBar(p) {
    var id = useId('flt');
    /* il nome del campo e la frase d'aiuto legata li dà il modulo, nella sua lingua (richieste 173 e 19) */
    var search = p.search !== false ? h('label', { className: 'zr-input has-icon zr-filter-search' }, h(Icon, { name: 'search', size: 16 }),
      h('input', { type: 'search', placeholder: p.searchPlaceholder || 'Cerca…', 'aria-label': p.searchLabel || 'Cerca', 'aria-describedby': p.searchHint ? id + '-h' : undefined, value: p.query, onChange: p.onQuery ? function (e) { p.onQuery(e.target.value); } : undefined })) : null;
    /* compact: al telefono i filtri stanno in una riga che scorre e lasciano spazio alle liste (richiesta 51) */
    return h('div', { className: cx('zr-filterbar', p.compact && 'is-compact') },
      search && p.searchHint ? h('div', { className: 'zr-filter-search-wrap' }, search, h('p', { id: id + '-h', className: 'zr-filter-hint' }, p.searchHint)) : search,
      p.compact ? h('div', { className: 'zr-filter-items' }, p.children) : p.children,
      p.actions ? h('div', { className: 'zr-filter-actions' }, p.actions) : null);
  }

export { FilterBar };
