// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Switch di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { omit } from './interni/omit';

  function Switch(p) {
    var ctrl = p.checked !== undefined;
    var st = useState(!!p.defaultChecked), on = ctrl ? p.checked : st[0];
    var off = p['aria-disabled'] === true || p['aria-disabled'] === 'true'; /* spento ma raggiungibile: tiene il fuoco */
    var rest = omit(p, ['label', 'checked', 'defaultChecked', 'onChange', 'onClick', 'className', 'children', 'type', 'role']); /* id, ref, name, data-*, aria-describedby e aria-invalid passano al pulsante (richieste 179 e 249) */
    return h('button', Object.assign(rest, { type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': p['aria-label'] || p.label, 'aria-disabled': off ? 'true' : undefined, className: cx('zr-switch', on && 'is-on', p.className),
      onClick: function (e) { if (p.onClick) p.onClick(e); if (off || e.defaultPrevented) return; if (!ctrl) st[1](!on); if (p.onChange) p.onChange(!on); } }),
      h('span', { className: 'zr-switch-track', 'aria-hidden': true }, h('span', { className: 'zr-switch-thumb' })),
      p.label ? h('span', { className: 'zr-switch-label' }, p.label) : null);
  }

export { Switch };
