// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 2 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './h';
import { useState } from './useState';
import { useRef } from './useRef';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { tpl } from './tpl';
import { assistantOf } from './assistantOf';
import { AssistantAvatar } from '../AssistantAvatar';
import { scrollStop } from './SHELL_FOCUSABLE';
import { useEffect } from './useEffect';
import '../../../css/zeiras/AssistantPanel.css';

  /* ---------- Assistenti: la conversazione (307) e la sessione a schermo intero (308) ---------- */
  function assistantName(p) { return p.name || assistantOf(p.assistant).name; }
  /* i messaggi di una conversazione: dell'assistente a sinistra con l'avatar, miei a destra, i passaggi fra assistenti al centro */
  function AssistantMessages(p) {
    var T = p.T, name = assistantName(p), ref = useRef(null), n = (p.messages || []).length;
    useEffect(function () { var el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [n, !!p.typing]); /* il messaggio nuovo in vista */
    useEffect(function () { var el = ref.current; if (el) return scrollStop(el, true); }, []); /* la lista che scorre è nel giro del Tab finché dentro niente prende il fuoco */
    function msg(m, i) {
      if (m.from === 'handoff') return h('div', { key: m.id || i, className: 'zr-amsg is-handoff' },
        h(AssistantAvatar, { assistant: m.assistant || p.assistant, size: 22, decorative: true }), h(Icon, { name: 'arrow', size: 14 }),
        h(AssistantAvatar, { assistant: m.to, size: 22, decorative: true }), h('span', null, m.text));
      if (m.from === 'me') return h('div', { key: m.id || i, className: 'zr-amsg is-me' },
        h('div', { className: 'zr-amsg-wrap' }, m.attachments || null, h('div', { className: 'zr-amsg-bubble' }, m.text)));
      var who = m.assistant || p.assistant, whoName = m.name || (m.assistant ? assistantOf(m.assistant).name : name);
      return h('div', { key: m.id || i, className: 'zr-amsg' },
        h(AssistantAvatar, { assistant: who, size: 28, decorative: true }),
        h('div', { className: 'zr-amsg-wrap' },
          h('div', { className: 'zr-amsg-meta' }, [whoName, m.time].filter(Boolean).join(' · ')),
          m.text != null ? h('div', { className: 'zr-amsg-bubble' }, m.text) : null,
          m.content || null,
          m.actions ? h('div', { className: 'zr-amsg-actions' }, m.actions) : null));
    }
    return h('div', { ref: ref, className: 'zr-amsgs', role: 'log', 'aria-live': 'polite', 'aria-label': p.label || T.messages },
      p.empty && !n ? p.empty : null,
      (p.messages || []).map(msg),
      p.typing ? h('div', { className: 'zr-amsg is-typing' },
        h(AssistantAvatar, { assistant: p.assistant, size: 28, decorative: true }),
        h('div', { className: 'zr-amsg-wrap' },
          h('div', { className: 'zr-amsg-bubble' }, h('span', { className: 'zr-typing', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))),
          h('div', { className: 'zr-amsg-meta' }, tpl(T.writingDoc, { name: name })))) : null);
  }
  /* il campo per scrivere: Invio manda, il testo resta se onSend dice di no (torna false) */
  function AssistantComposer(p) {
    var T = p.T, st = useState(''), v = p.value !== undefined ? p.value : st[0];
    function set(x) { if (p.onChange) p.onChange(x); if (p.value === undefined) st[1](x); }
    function send(e) { e.preventDefault(); var t = String(v).trim(); if (!t || p.disabled) return; var r = p.onSend ? p.onSend(t) : undefined; if (r !== false) set(''); }
    return h('form', { className: 'zr-acomp', onSubmit: send },
      p.before || null,
      h('input', { className: 'zr-acomp-input', type: 'text', value: v, autoComplete: 'off', 'data-autofocus': p.autoFocus ? '' : undefined, placeholder: p.placeholder || tpl(T.placeholder, { name: p.name }), 'aria-label': p.placeholder || tpl(T.placeholder, { name: p.name }), disabled: p.disabled, onChange: function (e) { set(e.target.value); } }),
      h(Button, { type: 'submit', variant: 'primary', size: 'sm', icon: 'arrow', 'aria-label': T.send, className: 'zr-acomp-send' }));
  }

export { AssistantComposer, AssistantMessages, assistantName };
