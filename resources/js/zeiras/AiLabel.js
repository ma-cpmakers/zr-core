// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AiLabel di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { ASSISTANT_TEXTS } from './interni/ASSISTANT_TEXTS';
import { useCompLabels } from './interni/useCompLabels';
import '../../css/zeiras/AssistantAvatar.css';

  /* «Assistente AI»: chi scrive è un assistente e non una persona (310) */
  function AiLabel(p) {
    var T = useCompLabels(ASSISTANT_TEXTS, p.labels);
    return h('span', { className: cx('zr-ai-label', p.className) }, h(Icon, { name: 'sparkle', size: 12 }), p.label || T.aiLabel);
  }

export { AiLabel };
