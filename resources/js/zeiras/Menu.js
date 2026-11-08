// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Menu di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useId } from './AppShell';

  /* ---------- Menu (P-15: menu contestuali e «+») ---------- */
  function Menu(p) {
    var ref = useRef(null), mid = useId('mnu'), last = useRef(p); last.current = p; /* Esc legge le props di adesso (returnFocus arrivato dopo l'apertura) */
    React.useEffect(function () {
      function close(e) { if (ref.current && !ref.current.contains(e.target) && e.target !== p.anchor && !(p.anchor && p.anchor.contains && p.anchor.contains(e.target))) p.onClose(); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); last.current.onClose(); back(); } }
      var t = setTimeout(function () { document.addEventListener('mousedown', close); }, 0);
      document.addEventListener('keydown', key, true);
      var first = ref.current && (ref.current.querySelector('[role^="menuitem"]:not(:disabled):not([aria-disabled="true"])') || ref.current.querySelector('[role^="menuitem"]:not(:disabled)')); if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      return function () { clearTimeout(t); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key, true); };
    }, []);
    /* aperto, segue il pulsante quando la pagina (o un contenitore) scorre e quando la finestra cambia misura: si rimisura a ogni fotogramma che ne ha uno (richiesta 219) */
    var follow = useState(0)[1];
    React.useEffect(function () {
      if (p.inline) return;
      var raf = 0;
      function f(e) { if (e && e.type === 'scroll' && ref.current && e.target instanceof Node && ref.current.contains(e.target)) return; if (!raf) raf = requestAnimationFrame(function () { raf = 0; follow(function (n) { return n + 1; }); }); }
      window.addEventListener('resize', f); document.addEventListener('scroll', f, true);
      return function () { window.removeEventListener('resize', f); document.removeEventListener('scroll', f, true); if (raf) cancelAnimationFrame(raf); };
    }, [p.inline]);
    var items = p.items || [];
    function anchorRect() { return p.anchor && p.anchor.getBoundingClientRect ? p.anchor.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 }; }
    var r = anchorRect();
    var W = 240, vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    var left = Math.max(8, Math.min(p.align === 'end' ? r.right - W : r.left, vw - W - 8));
    var top = r.bottom + 6;
    /* il fuoco torna a returnFocus se è nella pagina (richiesta 217, come DetailPanel), altrimenti al pulsante che ha aperto il menu */
    function back() { var q = last.current, rf = q.returnFocus, t = rf && rf.current !== undefined ? rf.current : rf; if (!(t && t.focus && document.contains(t))) t = q.anchor; if (t && t.focus && document.contains(t)) t.focus(); }
    /* misurato (le righe del perché, richiesta 83; la testa): sotto se ci sta, altrimenti sopra se ci sta, altrimenti dal lato con più spazio, alto quanto quel lato e con lo scroll; dentro la finestra a 8 px dai bordi, anche col pulsante fuori vista o una voce lunga (richiesta 216) */
    React.useLayoutEffect(function () { var m = ref.current; if (p.inline || !m || (p.anchor && !document.contains(p.anchor))) return; r = anchorRect(); /* un pulsante uscito dalla pagina non sposta il menu */ vw = window.innerWidth || 1024; vh = window.innerHeight || 768; /* misurato dopo il commit: un pulsante spostato nello stesso disegno porta il menu con sé (richiesta 219) */ var st = m.scrollTop, cs = getComputedStyle(m); m.style.maxHeight = ''; m.style.overflowY = ''; m.style.maxWidth = ''; m.style.left = '0px'; /* misurato a sinistra: la larghezza non dipende da dov'era */
      var b = m.getBoundingClientRect(); if (b.width > vw - 16) { m.style.maxWidth = Math.max(vw - 16 - (b.width - parseFloat(cs.width)), 0) + 'px'; b = m.getBoundingClientRect(); } /* il max-width del CSS non conta padding e bordo */
      var hgt = b.height, lo = Math.max(8, r.bottom + 6), hi = Math.min(vh - 8, r.top - 6), below = vh - 8 - lo, above = hi - 8;
      if (hgt <= below) m.style.top = lo + 'px';
      else if (hgt <= above) m.style.top = hi - hgt + 'px';
      else { var dn = below >= above, room = Math.max(dn ? below : above, 0); m.style.maxHeight = Math.max(room - (hgt - parseFloat(cs.height)), 0) + 'px'; m.style.overflowY = 'auto'; m.style.top = (dn ? lo : 8) + 'px'; m.scrollTop = st; }
      var bw = m.getBoundingClientRect().width; /* dopo lo scroll: la barra classica allarga il menu */
      m.style.left = Math.max(8, Math.min(p.align === 'end' ? r.right - bw : r.left, vw - bw - 8)) + 'px';
    });
    function move(e) {
      if (e.key === 'Tab') { if (p.anchor && p.anchor.focus && document.contains(p.anchor)) { e.preventDefault(); if (p.onClose) p.onClose(); p.anchor.focus(); } return; } /* richiesta 93: col pulsante che l'ha aperto il fuoco torna lì; senza, il Tab resta del browser o di chi contiene il menu (un Dialog) */
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return; /* Home e Fine: la prima e l'ultima voce (richiesta 132) */
      e.preventDefault();
      var list = Array.prototype.slice.call(ref.current.querySelectorAll('[role^="menuitem"]:not(:disabled)'));
      var i = list.indexOf(document.activeElement);
      var n = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]; if (n) n.focus();
    }
    return h('div', { ref: ref, className: cx('zr-menu', p.className), role: 'menu', 'aria-label': p.label, style: p.inline ? null : { top: top, left: left }, onKeyDown: move },
      p.head ? h('div', { className: 'zr-menu-head', role: 'presentation' }, p.head) : null,
      items.map(function (it, i) {
        if (it.sep) return h('div', { key: 'sep' + i, className: 'zr-menu-sep', role: 'separator' });
        /* spenta col perché: resta raggiungibile con le frecce e dice perché non si può, a vista e al lettore (richiesta 83) */
        var why = it.disabled && it.reason, wid = why ? mid + '-r' + i : undefined;
        var pick = typeof it.checked === 'boolean'; /* una scelta fra più (la pipeline, la vista): menuitemradio con aria-checked e il segno (richiesta 1) */
        var item = h('button', { key: i, type: 'button', role: pick ? 'menuitemradio' : 'menuitem', 'aria-checked': pick ? it.checked : undefined, className: cx('zr-menu-item', it.danger && 'is-danger', why && 'is-disabled'), disabled: it.disabled && !why, 'aria-disabled': why ? true : undefined, 'aria-describedby': wid,
          onClick: function () { if (why) return; p.onClose && p.onClose(); back(); if (it.onClick) it.onClick(); } },
          it.icon ? h(Icon, { name: it.icon, size: 16 }) : pick ? (it.checked ? h(Icon, { name: 'check', size: 16 }) : h('span', { className: 'zr-menu-check', 'aria-hidden': true })) : null, h('span', { className: 'zr-menu-label' }, it.label), it.hint ? h('kbd', { className: 'zr-kbd' }, it.hint) : null);
        return why ? [item, h('p', { key: 'r' + i, id: wid, className: 'zr-menu-reason', 'aria-hidden': true }, it.reason)] : item;
      }));
  }

export { Menu };
