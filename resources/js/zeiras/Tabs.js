// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Tabs di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { countParts } from './interni/countParts';
import { Icon } from './Icon';
import { useEffect } from './interni/useEffect';

  function Tabs(p) {
    var items = p.items || [];
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue || (items[0] && (items[0].value || items[0]))), val = ctrl ? p.value : st[0];
    var vals = items.map(function (it) { return typeof it === 'string' ? it : it.value; });
    var stop = vals.indexOf(val) >= 0 ? val : vals[0]; /* una fermata sola del Tab: la linguetta scelta (richieste 151 e 69) */
    function pick(v) { if (!ctrl) st[1](v); if (p.onChange) p.onChange(v); }
    var ref = useRef(null);
    useEffect(function () { /* la riga che scorre di lato (underline sotto i 720 px) porta in vista la linguetta scelta, senza muovere la pagina (richiesta 204) */
      var l = ref.current, b = l && l.querySelector('.is-active'); if (!b || l.scrollWidth <= l.clientWidth) return;
      var r = b.getBoundingClientRect(), lr = l.getBoundingClientRect();
      if (r.left < lr.left) l.scrollLeft -= lr.left - r.left + 16; else if (r.right > lr.right) l.scrollLeft += r.right - lr.right + 16;
    }, [val]);
    function keys(e) {
      var i = vals.indexOf(e.target.getAttribute('data-value')); if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return; /* Alt+← resta «indietro» del browser */
      var n = e.key === 'ArrowRight' ? (i + 1) % vals.length : e.key === 'ArrowLeft' ? (i + vals.length - 1) % vals.length : e.key === 'Home' ? 0 : e.key === 'End' ? vals.length - 1 : -1;
      if (n < 0) return;
      e.preventDefault(); if (vals[n] !== val) pick(vals[n]);
      var b = e.currentTarget.querySelectorAll('[role="tab"]')[n]; if (b) b.focus();
    }
    return h('div', { className: cx('zr-seg', p.variant === 'underline' && 'is-underline', p.size === 'sm' && 'is-sm', p.className), ref: ref, role: 'tablist', 'aria-label': p['aria-label'], onKeyDown: keys },
      items.map(function (it) {
        var v = typeof it === 'string' ? it : it.value, l = typeof it === 'string' ? it : it.label;
        return h('button', { key: v, type: 'button', role: 'tab', 'data-value': v, 'aria-selected': v === val, 'aria-controls': it.panelId, id: it.panelId ? it.panelId + '-tab' : undefined, tabIndex: v === stop ? 0 : -1, className: cx('zr-seg-item', v === val && 'is-active'),
          onClick: function () { pick(v); } }, it.icon ? h(Icon, { name: it.icon, size: 16 }) : null, l, it.count != null ? countParts(it.count, 'zr-seg-count', it.countLabel) : null);
      }));
  }

export { Tabs };
