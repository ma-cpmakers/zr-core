// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Toast di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useLabels } from './useLabels';
import { TONE_ICON } from './interni/TONE_ICON';

  function Toast(p) {
    var tone = p.tone || 'success', C = useLabels();
    return h('div', { className: cx('zr-toast', 'zr-toast-' + tone), role: 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 18 }),
      h('span', { className: 'zr-toast-text' }, p.children),
      p.actionLabel ? h('button', { type: 'button', className: 'zr-toast-action', onClick: p.onAction }, p.actionLabel) : null,
      p.onClose ? h('button', { type: 'button', className: 'zr-toast-close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }, h(Icon, { name: 'close', size: 16 })) : null);
  }

export { Toast };
