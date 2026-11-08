// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AutomationStep di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { STEP_META } from './interni/STEP_META';

  function AutomationStep(p) {
    var m = STEP_META[p.type] || STEP_META.action;
    return h('div', { className: cx('zr-step-node', 'is-' + p.type, p.selected && 'is-selected'), tabIndex: 0, role: 'button', onClick: p.onClick },
      h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + m[2]) }, h(Icon, { name: p.icon || m[1], size: 18 })),
      h('div', { className: 'zr-step-text' }, h('span', { className: 'zr-overline zr-overline-muted' }, m[0]), h('strong', null, p.title), p.detail ? h('span', null, p.detail) : null),
      p.stats ? h('span', { className: 'zr-step-stats' }, p.stats) : null);
  }

export { AutomationStep };
