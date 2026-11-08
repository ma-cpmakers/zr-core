// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ReorderList di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { useEffect } from './interni/useEffect';
import { useCompLabels } from './interni/useCompLabels';
import { REORDER_LABELS } from './REORDER_LABELS';

  var REORDER_TEXTS = { it: REORDER_LABELS,
    en: { up: 'Move up', down: 'Move down', moved: '{item}: position {n} of {total}' },
    es: { up: 'Subir', down: 'Bajar', moved: '{item}: posición {n} de {total}' } };
  function ReorderList(p) {
    var L = useCompLabels(REORDER_TEXTS, p.labels), items = p.items || [];
    var ms = useState(''), said = ms[0], say = ms[1];
    var dg = useState(null), drag = dg[0], setDrag = dg[1];
    var listRef = useRef(null), want = useRef(null), dragRef = useRef(null);
    function fill(t, k, v) { return t.replace(k, function () { return v; }); }
    function nameOf(it) { return typeof it.label === 'string' || typeof it.label === 'number' ? String(it.label) : String(it.id); }
    function move(from, to, how) {
      if (from === to || to < 0 || to >= items.length) return;
      var n = items.slice(), it = n.splice(from, 1)[0]; n.splice(to, 0, it);
      say(fill(fill(fill(L.moved, '{item}', nameOf(it)), '{n}', String(to + 1)), '{total}', String(n.length)));
      want.current = how ? { id: String(it.id), how: how } : null;
      if (p.onChange) p.onChange(n);
    }
    useEffect(function () { /* la riga spostata coi pulsanti si porta dietro il fuoco; all'estremo passa all'altro pulsante */
      var w = want.current, u = listRef.current; if (!w || !u) return; want.current = null;
      var li = [].filter.call(u.children, function (x) { return x.getAttribute('data-id') === w.id; })[0], b = li && li.querySelector('[data-move="' + w.how + '"]');
      if (b && b.getAttribute('aria-disabled') === 'true') b = li.querySelector('[data-move="' + (w.how === 'up' ? 'down' : 'up') + '"]');
      if (b) b.focus();
    });
    function grab(e, i) {
      if (e.button > 0 || items.length < 2) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* senza cattura si segue lo stesso */ }
      var rows = [].map.call(listRef.current.children, function (x) { var r = x.getBoundingClientRect(); return { top: r.top, h: r.height }; });
      dragRef.current = { i: i, to: i, y0: e.clientY, dy: 0, rows: rows, pid: e.pointerId }; setDrag(dragRef.current);
    }
    function follow(e) {
      var d = dragRef.current; if (!d || e.pointerId !== d.pid) return;
      var dy = e.clientY - d.y0, r = d.rows[d.i], mid = r.top + r.h / 2 + dy, to = 0;
      d.rows.forEach(function (x, k) { if (k !== d.i && mid > x.top + x.h / 2) to++; });
      dragRef.current = Object.assign({}, d, { dy: dy, to: to }); setDrag(dragRef.current);
    }
    function drop() { var d = dragRef.current; if (!d) return; dragRef.current = null; setDrag(null); move(d.i, d.to, null); }
    function cancel() { dragRef.current = null; setDrag(null); }
    useEffect(function () { /* Esc mentre si trascina lascia tutto com'era, e resta suo */
      if (!drag) return;
      function k(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }
      document.addEventListener('keydown', k, true); return function () { document.removeEventListener('keydown', k, true); };
    }, [!!drag]);
    function shift(k) {
      if (!drag) return 0;
      if (k === drag.i) return drag.dy;
      var hd = drag.rows[drag.i].h;
      return drag.i < k && k <= drag.to ? -hd : drag.to <= k && k < drag.i ? hd : 0;
    }
    return h('div', { className: cx('zr-reorder-wrap', p.className) },
      h('ul', { ref: listRef, className: cx('zr-reorder', drag && 'is-dragging'), 'aria-label': p['aria-label'] },
        items.map(function (it, k) {
          var y = shift(k), last = k === items.length - 1;
          function mv(dir, off, to) {
            return h(Button, { variant: 'ghost', size: 'sm', icon: dir === 'up' ? 'chevronUp' : 'chevronDown', 'data-move': dir, 'aria-label': (dir === 'up' ? L.up : L.down) + ': ' + nameOf(it),
              'aria-disabled': off ? true : undefined, onClick: function () { if (!off) move(k, to, dir); } });
          }
          return h('li', { key: it.id, 'data-id': it.id, className: cx('zr-reorder-item', drag && drag.i === k && 'is-dragging'), style: y ? { transform: 'translateY(' + y + 'px)' } : undefined },
            h('span', { className: 'zr-reorder-handle', 'aria-hidden': true, onPointerDown: function (e) { grab(e, k); }, onPointerMove: follow, onPointerUp: drop, onPointerCancel: cancel }, h(Icon, { name: 'menu', size: 18 })),
            h('div', { className: 'zr-reorder-body' }, p.render ? p.render(it) : [h('div', { key: 'l', className: 'zr-reorder-label' }, it.label), it.description ? h('div', { key: 'd', className: 'zr-reorder-desc' }, it.description) : null]),
            h('div', { className: 'zr-reorder-moves' }, mv('up', k === 0, k - 1), mv('down', last, k + 1)));
        })),
      h('p', { className: 'zr-visually-hidden zr-reorder-live', 'aria-live': 'polite' }, said));
  }

export { ReorderList };
