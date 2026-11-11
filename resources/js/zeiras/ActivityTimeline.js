// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ActivityTimeline di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { Label } from './Label';
import { ACT_ICON } from './interni/ACT_ICON';

  function ActivityTimeline(p) {
    return h('ol', { className: 'zr-timeline' }, (p.items || []).map(function (it, i) {
      var ic = ACT_ICON[it.type] || ['info', 'neutral'];
      return h('li', { key: it.id != null ? it.id : i },
        h('span', { className: cx('zr-iconbox', 'zr-iconbox-xs', 'zr-label-' + ic[1]) }, h(Icon, { name: ic[0], size: 14 })),
        h('div', { className: 'zr-tl-body' },
          h('div', { className: 'zr-tl-head' }, h('strong', null, it.title), h('time', null, it.time)),
          it.outcome ? h('div', { className: 'zr-tl-outcome' }, h(Label, { tone: it.outcomeTone || 'neutral' }, it.outcome)) : null,
          it.edit ? h('div', { className: 'zr-tl-edit' }, it.edit) : it.text ? h('p', null, it.text) : null,
          it.by ? h('span', { className: 'zr-tl-by' }, it.by) : null,
          it.actions && it.actions.length && !it.edit ? h('div', { className: 'zr-tl-actions' }, it.actions.map(function (a, j) {
            return h(Button, { key: j, variant: a.tone === 'danger' ? 'danger' : 'ghost', size: 'sm', icon: a.icon, disabled: a.disabled, 'aria-label': a.label + ': ' + it.title, onClick: a.onClick }, a.label);
          })) : null));
    }));
  }

export { ActivityTimeline };
