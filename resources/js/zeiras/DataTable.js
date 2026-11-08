// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DataTable di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { fmtNum } from './interni/fmtNum';
import { Field } from './Field';
import { Checkbox } from './Checkbox';
import { useCompLabels } from './interni/useCompLabels';
import { EmptyState } from './EmptyState';
import { DATATABLE_TEXTS } from './interni/DATATABLE_TEXTS';

  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var L = useCompLabels(DATATABLE_TEXTS, p.labels);
    var loc = p.locale, nf = null;
    if (loc) try { nf = new Intl.NumberFormat(loc); } catch (e) { loc = null; } /* una lingua che il browser non conosce non rompe la tabella: si usa la forma italiana */
    var num = nf ? function (v) { return nf.format(v); } : fmtNum;
    function fill(t, k, v) { return t.replace(k, function () { return v; }); } /* il testo del modulo entra com'è, anche con «$&» */
    /* ordine e selezione li può tenere la pagina (sort/onSort, selected/onSelect): allora la tabella mostra le righe come arrivano, già ordinate dal server, e chiede (richiesta 203) */
    var so = useState(p.defaultSort || null), sortOwn = p.sort !== undefined, sort = sortOwn ? p.sort : so[0];
    function setSort(v) { if (!sortOwn) so[1](v); if (p.onSort) p.onSort(v); }
    var se = useState([]), selOwn = p.selected !== undefined, sel = selOwn ? p.selected || [] : se[0];
    function setSel(n) { if (!selOwn) se[1](n); if (p.onSelect) p.onSelect(n); }
    var pg = useState(0), page = pg[0], setPage = pg[1];
    var more = !!p.onMore; /* con onMore le righe arrivano a blocchi: si mostrano tutte, niente pagine */
    var size = p.pageSize || 8, from = more ? 0 : page * size;
    var sorted = rows.slice();
    if (sort && !sortOwn) {
      var c = cols.find(function (x) { return x.key === sort.key; });
      var get = (c && c.sortValue) || function (r) { return r[sort.key]; };
      sorted.sort(function (a, b) { var x = get(a), y = get(b); var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), loc || 'it'); return sort.dir === 'asc' ? r : -r; });
    }
    var pages = more ? 1 : Math.max(1, Math.ceil(sorted.length / size));
    var shown = more ? sorted : sorted.slice(from, from + size), total = p.total != null ? p.total : rows.length;
    var rid = function (r, i) { return r.id != null ? r.id : i; };
    var allOn = shown.length > 0 && shown.every(function (r, i) { return sel.indexOf(rid(r, i)) >= 0; });
    function all() { var ids = shown.map(rid), n = allOn ? sel.filter(function (x) { return ids.indexOf(x) < 0; }) : Array.from(new Set(sel.concat(ids))); setSel(n); } /* anche «Seleziona tutti» lo dice al modulo, come la casella di una riga */
    var off = !!p.selectionDisabled; /* durante un'operazione sulle righe scelte la selezione non cambia: caselle e «Deseleziona» spenti (richiesta 215) */
    /* una riga sola: «1 selezionato»; se la pagina ha dato solo il suo «selected», resta quello (richiesta 214) */
    var selText = sel.length === 1 && !(p.labels && p.labels.selected && !p.labels.selectedOne) ? L.selectedOne : L.selected;
    function rowLabel(r) { var n = p.rowName ? p.rowName(r) : null; return (n || n === 0) && !(p.labels && p.labels.selectRow && !p.labels.selectRowName) ? fill(L.selectRowName, '{name}', String(n)) : L.selectRow; } /* «Seleziona Mario Rossi»: il lettore di schermo distingue le righe (richiesta 213) */
    function toggle(id) { var n = sel.indexOf(id) >= 0 ? sel.filter(function (x) { return x !== id; }) : sel.concat([id]); setSel(n); }
    var sortCols = cols.filter(function (c) { return c.sortable !== false; });
    var sortOpts = (sort ? [] : [{ value: '', label: L.sortNone }]).concat([].concat.apply([], sortCols.map(function (c) {
      return [{ value: c.key + ':asc', label: fill(L.ascending, '{col}', c.label || c.srLabel || '') }, { value: c.key + ':desc', label: fill(L.descending, '{col}', c.label || c.srLabel || '') }];
    })));
    return h('div', { className: 'zr-table-wrap' },
      p.selectable && sel.length ? h('div', { className: 'zr-bulk' }, h('strong', null, fill(selText, '{n}', num(sel.length))), p.bulkActions || null,
        h(Button, { variant: 'ghost', size: 'sm', disabled: off, onClick: function () { setSel([]); } }, L.deselect)) : null,
      sortCols.length && rows.length > 1 ? h(Field, { className: 'zr-table-sortbar', label: L.sortBy, options: sortOpts, value: sort ? sort.key + ':' + sort.dir : '',
        onChange: function (e) { var v = e.target.value.split(':'); setSort(v[0] ? { key: v[0], dir: v[1] } : null); setPage(0); } }) : null,
      p.selectable && shown.length ? h('div', { className: 'zr-table-selectall' }, h(Checkbox, { label: L.selectAll, checked: allOn, disabled: off, onChange: all })) : null, /* sotto 720 px l'intestazione è nascosta: «Seleziona tutti» sta qui */
      h('div', { className: 'zr-table-scroll' },
        h('table', { className: cx('zr-table', p.stickyFirst && 'is-sticky-first') }, /* stickyFirst: la prima colonna (con la casella) resta ferma quando la tabella scorre di lato */
          h('thead', null, h('tr', null,
            p.selectable ? h('th', { className: 'zr-td-check' }, h(Checkbox, { 'aria-label': L.selectAll, checked: allOn, disabled: off, onChange: all })) : null,
            cols.map(function (c, k) {
              var active = sort && sort.key === c.key;
              return h('th', { key: c.key, className: cx(c.align === 'right' && 'is-right', !k && 'zr-td-first'), style: c.width || c.minWidth ? { width: c.width, minWidth: c.minWidth } : undefined, 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined },
                c.sortable === false ? (c.label || (c.srLabel ? h('span', { className: 'zr-visually-hidden' }, c.srLabel) : null)) : h('button', { type: 'button', className: cx('zr-th-sort', active && 'is-active'), onClick: function () { setSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' }); } }, c.label || (c.srLabel ? h('span', { className: 'zr-visually-hidden' }, c.srLabel) : null), h(Icon, { name: active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort', size: 14 })));
            }))),
          h('tbody', null, shown.length ? shown.map(function (r, i) {
            var id = rid(r, from + i), on = sel.indexOf(id) >= 0;
            return h('tr', { key: id, className: cx(on && 'is-selected', p.onRowClick && 'is-clickable'), onClick: p.onRowClick ? function () { p.onRowClick(r); } : undefined },
              p.selectable ? h('td', { className: 'zr-td-check', onClick: function (e) { e.stopPropagation(); } }, h(Checkbox, { 'aria-label': rowLabel(r), checked: on, disabled: off, onChange: function () { toggle(id); } })) : null,
              cols.map(function (c, k) { return h('td', { key: c.key, 'data-label': typeof c.label === 'string' && c.label ? c.label : c.srLabel, /* la colonna senza titolo visibile (il ⋯) ha comunque un nome (richiesta 15) */ className: cx(c.align === 'right' && 'is-right', !k && 'zr-td-first') }, c.render ? c.render(r) : r[c.key]); }));
          }) : h('tr', null, h('td', { colSpan: cols.length + (p.selectable ? 1 : 0) }, p.empty || h(EmptyState, { compact: true, icon: 'search', title: L.emptyTitle, text: L.emptyText })))))),
      more && rows.length ? h('div', { className: 'zr-pager' }, /* le righe a blocchi: quante sono arrivate sul totale vero, detto quando cambia, e «Mostra altri» finché ne mancano */
        h('span', { 'aria-live': 'polite' }, fill(fill(fill(L.range, '{from}', num(1)), '{to}', num(rows.length)), '{total}', num(Math.max(total, rows.length)))),
        rows.length < total ? h(Button, { variant: 'secondary', size: 'sm', busy: p.loadingMore, onClick: p.onMore }, L.more) : null) :
      pages > 1 ? h('div', { className: 'zr-pager' },
        h('span', null, fill(fill(fill(L.range, '{from}', num(page * size + 1)), '{to}', num(Math.min(sorted.length, page * size + size))), '{total}', num(sorted.length))),
        h('div', null,
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevronLeft', 'aria-label': L.prev, disabled: page === 0, onClick: function () { setPage(page - 1); } }),
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevron', 'aria-label': L.next, disabled: page >= pages - 1, onClick: function () { setPage(page + 1); } }))) : null);
  }

export { DataTable };
