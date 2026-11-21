// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AssistantBubble di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { ASSISTANT_TEXTS } from './interni/ASSISTANT_TEXTS';
import { tpl } from './interni/tpl';
import { assistantOf } from './interni/assistantOf';
import { AssistantAvatar } from './AssistantAvatar';
import { useCompLabels } from './interni/useCompLabels';
import '../../css/zeiras/AssistantNav.css';

  /* il fumetto di un messaggio nuovo (306): nello spazio assistantBubble dell'AppShell, dentro la sua zona role="status" */
  function AssistantBubble(p) {
    var AT = useCompLabels(ASSISTANT_TEXTS, p.labels), a = p.assistant;
    if (!a) return null;
    var name = a.name || assistantOf(a.assistant).name;
    return h('button', { type: 'button', className: 'zr-asst-bubble', onClick: function (e) { if (p.onOpen) p.onOpen(a, e); }, 'aria-label': tpl(AT.openChat, { name: name }) + ': ' + p.text },
      h(AssistantAvatar, { assistant: a.assistant, size: 32, decorative: true }),
      h('span', { className: 'zr-asst-bubble-text' }, h('b', null, name), ': ', p.text, p.hint ? h('small', null, p.hint) : null));
  }

export { AssistantBubble };
