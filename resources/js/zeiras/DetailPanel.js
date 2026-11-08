// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DetailPanel di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Button } from './Button';
import { useLabels } from './useLabels';
import { FOCUSABLE } from './interni/FOCUSABLE';

  /* ---------- DetailPanel (P-15: dettaglio nel pannello a destra) ---------- */
  var PANEL_FULL = '(max-width: 720px)'; /* la stessa misura di bundle.css: sotto, il pannello copre la pagina */
  function DetailPanel(p) {
    var ref = useRef(null), last = useRef(p), C = useLabels(); last.current = p;
    var mqRef = useRef(undefined); if (mqRef.current === undefined) mqRef.current = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PANEL_FULL) : null;
    var mq = mqRef.current;
    var fullSt = useState(mq ? mq.matches : false), full = fullSt[0], setFull = fullSt[1];
    React.useEffect(function () {
      if (!mq) return;
      function ch() { setFull(mq.matches); }
      if (mq.addEventListener) mq.addEventListener('change', ch); else mq.addListener(ch);
      return function () { if (mq.removeEventListener) mq.removeEventListener('change', ch); else mq.removeListener(ch); };
    }, []);
    /* modale: con modal={true}, o da solo quando copre la pagina (sotto 720 px, non inline) */
    var modal = p.modal !== undefined ? !!p.modal : (!p.inline && full);
    React.useEffect(function () {
      var origin = document.activeElement;
      var t = ref.current && (ref.current.querySelector('[data-autofocus]') || ref.current);
      if (t && t.focus) try { t.focus({ preventScroll: true }); } catch (e) {}
      function key(e) {
        /* un Esc già usato da altro, o con sopra un dialogo o un menu, non chiude il pannello */
        if (e.key !== 'Escape' || e.defaultPrevented || !last.current.onClose) return;
        if (document.querySelector('.zr-scrim, .zr-menu, dialog[open], [role="menu"]')) return;
        last.current.onClose();
      }
      document.addEventListener('keydown', key);
      return function () {
        document.removeEventListener('keydown', key);
        var rf = last.current.returnFocus, target = rf && rf.current !== undefined ? rf.current : rf;
        var id = origin && origin.getAttribute && origin.getAttribute('data-id');
        var back = target && document.contains(target) ? target : id ? document.querySelector('[data-id="' + id + '"]') : origin;
        if (back && document.contains(back) && back.focus && !document.querySelector('.zr-detail')) try { back.focus({ preventScroll: true }); } catch (e) {}
      };
    }, []);
    /* il Tab resta dentro quando il pannello è modale */
    function trap(e) {
      if (!modal || e.key !== 'Tab' || e.defaultPrevented || !ref.current || document.querySelector('.zr-scrim, dialog[open]')) return; /* un dialogo aperto sopra tiene lui il Tab */
      var els = Array.prototype.filter.call(ref.current.querySelectorAll(FOCUSABLE), function (el) { return el.getClientRects().length > 0; });
      if (!els.length) { e.preventDefault(); ref.current.focus(); return; }
      var first = els[0], lastEl = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === ref.current)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && a === lastEl) { e.preventDefault(); first.focus(); }
    }
    var hasActs = p.actions != null && p.actions !== false && !(Array.isArray(p.actions) && !p.actions.some(Boolean));
    var closeBtn = h(Button, { variant: 'ghost', size: 'sm', icon: 'close', className: 'zr-detail-close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose });
    return h('aside', { ref: ref, tabIndex: -1, className: cx('zr-detail', p.inline && 'is-inline', p.className), role: 'dialog', 'aria-modal': modal ? 'true' : 'false', 'aria-label': p.label, onKeyDown: trap },
      h('header', { className: 'zr-detail-head' },
        h(Button, { variant: 'ghost', size: 'sm', icon: 'chevronLeft', className: 'zr-detail-back', onClick: p.onBack || p.onClose }, p.backLabel || C.back),
        h('div', { className: 'zr-detail-ctx' }, p.head),
        hasActs ? h('div', { className: 'zr-detail-actions' }, p.actions) : null, /* le azioni del pannello a destra, con la chiusura (richiesta 191): la ✕ resta al suo posto, non si rimonta */
        closeBtn),
      h('div', { className: 'zr-detail-body' }, p.children),
      p.foot ? h('footer', { className: 'zr-detail-foot' }, p.foot) : null);
  }

export { DetailPanel };
