// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Dialog di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Button } from './Button';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';
import { useLabels } from './useLabels';
import { FOCUSABLE } from './interni/FOCUSABLE';

  function Dialog(p) {
    var id = useId('dlg'), C = useLabels(), ref = useRef(null), last = useRef(p); last.current = p;
    useEffect(function () {
      if (!p.open) return;
      function k(e) { if (e.key === 'Escape' && p.onClose) p.onClose(); }
      document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); };
    }, [p.open]);
    /* il fuoco entra all'apertura e torna a chi lo aveva alla chiusura (richiesta 4): a [data-autofocus], o al primo elemento che lo prende
       (la «×» Chiudi), o al dialogo stesso se non ha niente; il fuoco già dentro (autoFocus di React, o il modulo) resta dov'è. L'anteprima (inline) non lo tocca */
    var inline = !!p.inline, from = useRef(null);
    if (!p.open) from.current = null; else if (!from.current) from.current = { el: typeof document !== 'undefined' ? document.activeElement : null }; /* chi aveva il fuoco prima che un autoFocus del contenuto lo prenda */
    useEffect(function () {
      if (!p.open || inline || !ref.current) return;
      var box = ref.current, origin = from.current && from.current.el;
      if (!origin || !document.contains(origin)) origin = box.contains(document.activeElement) ? null : document.activeElement; /* un dialogo che ne sostituisce un altro: il pulsante di quello è uscito, e il fuoco è già tornato alla pagina */
      if (!box.contains(document.activeElement)) {
        var t = box.querySelector('[data-autofocus]') || Array.prototype.find.call(box.querySelectorAll(FOCUSABLE), function (el) { return el.getClientRects().length > 0; }) || box;
        try { t.focus({ preventScroll: true }); } catch (e) {}
      }
      return function () {
        if (document.contains(box)) return; /* il dialogo è ancora nella pagina (il doppio effetto di StrictMode): niente da rendere */
        var rf = last.current.returnFocus, target = rf && rf.current !== undefined ? rf.current : rf, back = target || origin;
        var a = document.activeElement; /* a chi ha preso il fuoco nel frattempo, fuori dal dialogo, non si toglie */
        if (back && back !== document.body && document.contains(back) && back.focus && (!a || a === document.body || box.contains(a) || !document.contains(a))) try { back.focus({ preventScroll: true }); } catch (e) {}
      };
    }, [p.open, inline]);
    /* il Tab resta dentro: dall'ultimo elemento torna al primo, e da Maiusc+Tab sul primo all'ultimo (richiesta 4) */
    function trap(e) {
      if (e.key !== 'Tab' || inline || e.defaultPrevented || !ref.current || !ref.current.contains(e.target)) return;
      var box = ref.current, els = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (el) {
        if (el.type === 'radio' && el.name && !el.checked && Array.prototype.some.call(box.querySelectorAll('input[type="radio"]'), function (o) { return o.name === el.name && o.checked; })) return false; /* di un gruppo di radio con una scelta il Tab si ferma solo sulla scelta */
        return el.getClientRects().length > 0; });
      if (!els.length) { e.preventDefault(); box.focus(); return; }
      var first = els[0], lastEl = els[els.length - 1], a = document.activeElement, inLast = a === lastEl || (lastEl.type === 'radio' && a.type === 'radio' && a.name === lastEl.name), inFirst = a === first || (first.type === 'radio' && a.type === 'radio' && a.name === first.name);
      if (e.shiftKey && (inFirst || a === box)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && inLast) { e.preventDefault(); first.focus(); }
    }
    if (!p.open) return null;
    /* size="sm": una domanda sì/no resta piccola e al centro anche al telefono (richiesta 53) */
    return h('div', { className: cx('zr-scrim', p.inline && 'is-inline', p.size === 'sm' && 'is-compact'), onMouseDown: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { ref: ref, tabIndex: -1, className: cx('zr-dialog', p.size === 'lg' && 'is-lg', p.size === 'sm' && 'is-sm'), role: 'dialog', 'aria-modal': true, 'aria-labelledby': id, onKeyDown: trap },
        h('header', { className: 'zr-dialog-head' }, h('h2', { id: id }, p.title), p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }) : null),
        p.description ? h('p', { className: 'zr-dialog-desc' }, p.description) : null,
        h('div', { className: 'zr-dialog-body' }, p.children),
        p.footer ? h('footer', { className: 'zr-dialog-foot' }, p.footer) : null));
  }

export { Dialog };
