// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AssistantSession di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Button } from './Button';
import { Label } from './Label';
import { ASSISTANT_TEXTS } from './interni/ASSISTANT_TEXTS';
import { tpl } from './interni/tpl';
import { AssistantAvatar } from './AssistantAvatar';
import { AiLabel } from './AiLabel';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';
import { useCompLabels } from './interni/useCompLabels';
import { AssistantComposer, AssistantMessages, assistantName } from './interni/assistantName';
import '../../css/zeiras/AssistantAvatar.css';
import '../../css/zeiras/AssistantPanel.css';
import '../../css/zeiras/AssistantSession.css';

  /* la sessione con un assistente a tutta pagina: sessioni, chat, documento (308); sotto i 1180 px una colonna con le linguette Chat e Documento */
  var SESSION_NARROW = '(max-width: 1179px)';
  function AssistantSession(p) {
    var T = useCompLabels(ASSISTANT_TEXTS, p.labels), name = assistantName(p), sid = useId('ases');
    var mq = useRef(undefined); if (mq.current === undefined) mq.current = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(SESSION_NARROW) : null;
    var nSt = useState(mq.current ? mq.current.matches : false), narrow = nSt[0];
    useEffect(function () { var m = mq.current; if (!m) return; function ch() { nSt[1](m.matches); } if (m.addEventListener) m.addEventListener('change', ch); else m.addListener(ch); return function () { if (m.removeEventListener) m.removeEventListener('change', ch); else m.removeListener(ch); }; }, []);
    var tabSt = useState('chat'), tab = p.tab || tabSt[0];
    function setTab(t) { if (p.onTabChange) p.onTabChange(t); if (!p.tab) tabSt[1](t); }
    var sessions = p.sessions || [], doc = p.document, docOpen = p.documentOpen !== false;
    var list = h('aside', { className: 'zr-ases-list', 'aria-label': T.sessions },
      h(Button, { variant: 'primary', size: 'sm', icon: 'plus', className: 'zr-ases-new', onClick: p.onNewSession }, T.newSession),
      h('div', { className: 'zr-ases-over', id: sid + '-l' }, tpl(T.sessionsOf, { name: name })),
      h('ul', { className: 'zr-ases-items', 'aria-labelledby': sid + '-l' }, sessions.map(function (x) {
        var on = x.id === p.activeSession;
        return h('li', { key: x.id }, h('button', { type: 'button', className: cx('zr-ases-item', on && 'is-active'), 'aria-current': on ? 'true' : undefined, onClick: function () { if (p.onSessionSelect) p.onSessionSelect(x.id); } },
          h('b', null, x.title), x.meta ? h('small', null, x.meta) : null));
      })));
    var picker = h('div', { className: 'zr-ases-pick' },
      h('select', { className: 'zr-ases-select', 'aria-label': T.sessions, value: p.activeSession || '', onChange: function (e) { if (p.onSessionSelect) p.onSessionSelect(e.target.value); } },
        sessions.map(function (x) { return h('option', { key: x.id, value: x.id }, x.title); })),
      h(Button, { variant: 'secondary', size: 'sm', onClick: p.onNewSession }, T.newShort));
    var empty = h('div', { className: 'zr-ases-empty' }, h(AssistantAvatar, { assistant: p.assistant, size: 64, decorative: true }),
      h('h3', null, p.emptyTitle || tpl(T.emptyTitle, { name: name })), h('p', null, p.emptyText || tpl(T.emptyText, { name: name })), p.emptyActions ? h('div', { className: 'zr-ases-empty-acts' }, p.emptyActions) : null);
    var work = !docOpen ? null : h('section', { className: 'zr-ases-doc', 'aria-label': T.workArea, id: sid + '-doc', role: narrow ? 'tabpanel' : undefined, 'aria-labelledby': narrow ? sid + '-tdoc' : undefined, hidden: narrow && tab !== 'doc' ? true : undefined },
      doc ? [
        h('div', { key: 'h', className: 'zr-ases-doc-head' }, h('div', { className: 'zr-ases-doc-title' }, doc.kind ? h('div', { className: 'zr-ases-over' }, doc.kind) : null, h('h2', null, doc.title)),
          p.onDocumentClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': T.closeDocument, onClick: p.onDocumentClose }) : null),
        doc.tools || doc.writing ? h('div', { key: 't', className: 'zr-ases-doc-tools' }, doc.writing ? h('span', { className: 'zr-ai-label zr-ases-writing' }, h('span', { className: 'zr-typing', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), tpl(T.writingDoc, { name: name })) : doc.tools) : null,
        h('div', { key: 'b', className: 'zr-ases-doc-body', 'aria-busy': doc.writing ? 'true' : undefined }, doc.before || null, (doc.sections || []).map(function (sec, i) {
          return h('section', { key: sec.id || i, className: cx('zr-ases-sec', sec.fresh && 'is-fresh') },
            h('div', { className: 'zr-ases-sec-head' }, h('h3', null, sec.title), sec.editedBy ? h(Label, null, tpl(T.editedBy, { name: sec.editedBy })) : null,
              p.onRedoSection && !doc.writing ? h(Button, { variant: 'ghost', size: 'sm', icon: 'refresh', 'aria-label': tpl(T.redoSection, { title: sec.title }), onClick: function () { p.onRedoSection(sec, i); } }, T.redo) : null),
            sec.body);
        }), doc.writing ? h('div', { className: 'zr-ases-sec' }, h('span', { className: 'zr-typing', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))) : null),
        doc.foot ? h('div', { key: 'f', className: 'zr-ases-doc-foot' }, doc.foot) : null
      ] : empty);
    var chat = h('section', { className: 'zr-ases-chat', 'aria-label': T.chat, id: sid + '-chat', role: narrow ? 'tabpanel' : undefined, 'aria-labelledby': narrow ? sid + '-tchat' : undefined, hidden: narrow && docOpen && tab !== 'chat' ? true : undefined },
      narrow ? picker : null,
      h(AssistantMessages, { T: T, assistant: p.assistant, name: name, messages: p.messages, typing: p.typing, label: T.chat,
        empty: h('div', { className: 'zr-ases-empty is-chat' }, h(AssistantAvatar, { assistant: p.assistant, size: 72, decorative: true }), h('h3', null, p.newTitle || tpl(T.newSessionWith, { name: name })), p.newText ? h('p', null, p.newText) : null) }),
      h('div', { className: 'zr-ases-foot' }, p.commands || null,
        h(AssistantComposer, { T: T, name: name, onSend: p.onSend, value: p.draft, onChange: p.onDraftChange, disabled: p.disabled, before: p.attachments, placeholder: p.placeholder })));
    function tabBtn(id, label) { var on = tab === id; return h('button', { type: 'button', role: 'tab', id: sid + '-t' + id, 'aria-selected': on ? 'true' : 'false', 'aria-controls': sid + '-' + id, tabIndex: on ? 0 : -1, className: cx('zr-seg-item', on && 'is-active'), onClick: function () { setTab(id); },
      onKeyDown: function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') { e.preventDefault(); var to = id === 'chat' ? 'doc' : 'chat'; if (e.key === 'Home') to = 'chat'; if (e.key === 'End') to = 'doc'; setTab(to); var el = document.getElementById(sid + '-t' + to); if (el) el.focus(); } } }, label); }
    return h('div', { className: cx('zr-ases', !docOpen && 'is-doc-off', narrow && 'is-narrow', p.className) },
      h('header', { className: 'zr-ases-head' },
        p.back || null,
        h(AssistantAvatar, { assistant: p.assistant, size: 40, decorative: true }),
        h('div', { className: 'zr-ases-who' }, h('div', { className: 'zr-apanel-name' }, h('h1', null, name), h(AiLabel, { labels: p.labels })), p.subtitle ? h('div', { className: 'zr-ases-sub' }, p.subtitle) : null),
        narrow && docOpen ? h('div', { className: 'zr-seg zr-ases-tabs', role: 'tablist', 'aria-label': T.view }, tabBtn('chat', T.chat), tabBtn('doc', T.document)) : null,
        p.actions || null),
      h('div', { className: 'zr-ases-body' }, narrow ? null : list, chat, work));
  }

export { AssistantSession };
