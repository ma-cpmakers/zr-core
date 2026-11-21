// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AssistantNav di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { ASSISTANT_TEXTS } from './interni/ASSISTANT_TEXTS';
import { tpl } from './interni/tpl';
import { assistantOf } from './interni/assistantOf';
import { AssistantAvatar } from './AssistantAvatar';
import { useId } from './AppShell';
import { useCompLabels } from './interni/useCompLabels';
import '../../css/zeiras/AssistantNav.css';

  /* la sezione «Assistenti» del menu (306): nello spazio assistantNav dell'AppShell, sotto i moduli e nel cassetto */
  function AssistantNav(p) {
    var AT = useCompLabels(ASSISTANT_TEXTS, p.labels), sid = useId('asst');
    var assistants = p.assistants || [];
    function open(a, e) { if (p.onOpen) p.onOpen(a, e); }
    function row(a) {
      var who = assistantOf(a.assistant), name = a.name || who.name, writing = a.status === 'writing', un = a.unread || 0;
      var unText = un ? (un === 1 ? AT.unreadOne : tpl(AT.unreadMany, { n: un > 99 ? '99+' : un })) : '';
      var openName = tpl(AT.openChat, { name: name }) + (a.role ? ', ' + a.role : '') + (writing ? ', ' + AT.writing : '') + (un ? ', ' + unText : '');
      return h('div', { key: a.id, 'data-asst': a.id, className: cx('zr-asst', a.id === p.active && 'is-active', a.alert && 'is-alert'),
        onClick: function (e) { if (e.target.closest && e.target.closest('a, button')) return; open(a, e); } /* il resto della riga (il numero) apre la conversazione col puntatore; dalla tastiera la apre l'avatar */ },
        h('button', { type: 'button', className: 'zr-asst-open', 'aria-label': openName, 'aria-current': a.id === p.active ? 'true' : undefined, onClick: function (e) { open(a, e); } },
          h(AssistantAvatar, { assistant: a.assistant, size: 28, decorative: true }),
          h('i', { className: cx('zr-asst-dot', writing && 'is-writing'), 'aria-hidden': 'true' })),
        a.href ? h('a', { className: 'zr-asst-label', href: a.href, title: tpl(AT.openSession, { name: name }), onClick: function (e) { var l = e.currentTarget, to = p.navigate && !e.defaultPrevented && !e.button && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && l.protocol === location.protocol && l.host === location.host ? l.href : null; if (to) e.preventDefault(); if (p.onSession) p.onSession(a, e); if (to) p.navigate(to); } },
          h('span', { className: 'zr-asst-name' }, name), h('small', null, writing ? AT.writing : a.role))
          : h('span', { className: 'zr-asst-label' }, h('span', { className: 'zr-asst-name' }, name), h('small', null, writing ? AT.writing : a.role)),
        un ? h('span', { className: 'zr-asst-count', 'aria-hidden': 'true' }, un > 99 ? '99+' : un) : null);
    }
    return assistants.length ? h('div', { className: 'zr-nav-group is-assistants', role: 'group', 'aria-labelledby': sid },
      h('div', { className: 'zr-nav-title', id: sid }, AT.group),
      assistants.map(row)) : null;
  }

export { AssistantNav };
