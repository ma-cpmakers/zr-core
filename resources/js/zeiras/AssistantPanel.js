// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AssistantPanel di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { ASSISTANT_TEXTS } from './interni/ASSISTANT_TEXTS';
import { tpl } from './interni/tpl';
import { AssistantAvatar } from './AssistantAvatar';
import { AiLabel } from './AiLabel';
import { useEffect } from './interni/useEffect';
import { useLabels } from './useLabels';
import { useCompLabels } from './interni/useCompLabels';
import { PANEL_FULL } from './interni/PANEL_FULL';
import { FOCUSABLE } from './interni/FOCUSABLE';
import { AssistantComposer, AssistantMessages, assistantName } from './interni/assistantName';
import '../../css/zeiras/AssistantNav.css';
import '../../css/zeiras/AssistantPanel.css';

  /* la conversazione con un assistente: il pannello a destra sopra la pagina, sul modello del DetailPanel (307) */
  function AssistantPanel(p) {
    var T = useCompLabels(ASSISTANT_TEXTS, p.labels), C = useLabels(), name = assistantName(p);
    var ref = useRef(null), last = useRef(p); last.current = p;
    var mqRef = useRef(undefined); if (mqRef.current === undefined) mqRef.current = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PANEL_FULL) : null;
    var fullSt = useState(mqRef.current ? mqRef.current.matches : false), full = fullSt[0];
    useEffect(function () { var mq = mqRef.current; if (!mq) return; function ch() { fullSt[1](mq.matches); } if (mq.addEventListener) mq.addEventListener('change', ch); else mq.addListener(ch); return function () { if (mq.removeEventListener) mq.removeEventListener('change', ch); else mq.removeListener(ch); }; }, []);
    var modal = p.modal !== undefined ? !!p.modal : (!p.inline && full); /* sotto i 720 px copre la pagina: modale, come il DetailPanel */
    useEffect(function () {
      var origin = document.activeElement;
      var t = ref.current && (ref.current.querySelector('[data-autofocus]') || ref.current);
      if (t && t.focus && !p.inline) try { t.focus({ preventScroll: true }); } catch (e) {}
      function key(e) { if (e.key !== 'Escape' || e.defaultPrevented || !last.current.onClose) return; if (Array.prototype.some.call(document.querySelectorAll('.zr-scrim, .zr-menu, dialog[open], [role="menu"]'), function (el) { return el.getClientRects().length > 0; })) return; last.current.onClose(); }
      if (!p.inline) document.addEventListener('keydown', key);
      return function () {
        document.removeEventListener('keydown', key);
        var rf = last.current.returnFocus, target = rf && rf.current !== undefined ? rf.current : rf;
        function vis(el) { return el && document.contains(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
        var back = vis(target) ? target : vis(origin) ? origin : document.querySelector('.zr-top-menu'); /* aperto dal cassetto, che si è chiuso: torna ad «Apri il menu» */
        if (!last.current.inline && vis(back) && back.focus) try { back.focus({ preventScroll: true }); } catch (e) {}
      };
    }, []);
    function trap(e) {
      if (!modal || e.key !== 'Tab' || e.defaultPrevented || !ref.current || document.querySelector('.zr-scrim, dialog[open]')) return;
      var els = Array.prototype.filter.call(ref.current.querySelectorAll(FOCUSABLE), function (el) { return el.getClientRects().length > 0; });
      if (!els.length) { e.preventDefault(); ref.current.focus(); return; }
      var first = els[0], lastEl = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === ref.current)) { e.preventDefault(); lastEl.focus(); } else if (!e.shiftKey && a === lastEl) { e.preventDefault(); first.focus(); }
    }
    var writing = p.status === 'writing', ctxMoved = useRef(false);
    /* togliere o rimettere il contesto cambia il pulsante sotto il fuoco: il fuoco passa al pulsante nuovo, non al body */
    useEffect(function () { if (!ctxMoved.current) return; ctxMoved.current = false; var b = ref.current && (ref.current.querySelector('.zr-actx button') || ref.current.querySelector('.zr-acomp-input') || ref.current); if (b) b.focus(); }, [!!p.contextOff]);
    var ctx = p.context == null ? null : p.contextOff
      ? h('div', { className: 'zr-actx is-off' }, h('span', null, tpl(T.noContext, { name: name })), p.onContextRestore ? h(Button, { variant: 'ghost', size: 'sm', onClick: function (e) { ctxMoved.current = true; p.onContextRestore(e); } }, T.restoreContext) : null)
      : h('div', { className: 'zr-actx' }, h(Icon, { name: 'eye', size: 16 }), h('span', { className: 'zr-actx-text' }, h('b', null, tpl(T.sees, { name: name })), ' ', p.context),
        p.onContextRemove ? h('button', { type: 'button', className: 'zr-actx-x', 'aria-label': T.removeContext, title: T.removeContext, onClick: function (e) { ctxMoved.current = true; p.onContextRemove(e); } }, h(Icon, { name: 'close', size: 16 })) : null);
    var full_ = p.fullScreenHref ? h('a', { className: 'zr-btn zr-btn-secondary zr-btn-sm zr-apanel-full', href: p.fullScreenHref, onClick: p.onFullScreen }, h(Icon, { name: 'arrow', size: 16 }), h('span', null, T.fullScreen))
      : p.onFullScreen ? h(Button, { variant: 'secondary', size: 'sm', icon: 'arrow', className: 'zr-apanel-full', onClick: p.onFullScreen }, T.fullScreen) : null;
    return h('div', { ref: ref, tabIndex: -1, className: cx('zr-apanel', p.inline && 'is-inline', p.className), role: 'dialog', 'aria-modal': modal ? 'true' : 'false', 'aria-label': tpl(T.conversation, { name: name }), onKeyDown: trap },
      h('header', { className: 'zr-apanel-head' },
        h(AssistantAvatar, { assistant: p.assistant, size: 40, decorative: true }),
        h('div', { className: 'zr-apanel-who' },
          h('div', { className: 'zr-apanel-name' }, h('b', null, name), h(AiLabel, { labels: p.labels })),
          h('div', { className: 'zr-apanel-status' }, h('i', { className: cx('zr-asst-dot', 'is-inline', writing && 'is-writing'), 'aria-hidden': 'true' }), [writing ? T.writing : T.online, p.role].filter(Boolean).join(' · '))),
        h(Button, { variant: 'ghost', size: 'sm', icon: 'close', className: 'zr-apanel-close', 'aria-label': p.closeLabel || T.closeChat || C.close, onClick: p.onClose }),
        full_), /* «Apri a schermo intero» sotto il nome quando la riga non basta: a 400 px il nome e l'etichetta restano interi */
      ctx,
      p.notice ? h('div', { className: 'zr-apanel-notice' }, p.notice) : null,
      h(AssistantMessages, { T: T, assistant: p.assistant, name: name, messages: p.messages, typing: p.typing }),
      h('div', { className: 'zr-apanel-foot' },
        p.suggestions && p.suggestions.length ? h('div', { className: 'zr-asugg' }, p.suggestions.map(function (s, i) { return h(Button, { key: i, variant: 'secondary', size: 'sm', className: 'zr-asugg-item', onClick: function () { if (p.onSuggestion) p.onSuggestion(s); } }, s); })) : null,
        h(AssistantComposer, { T: T, name: name, autoFocus: true, onSend: p.onSend, value: p.draft, onChange: p.onDraftChange, disabled: p.disabled })));
  }

export { AssistantPanel };
