// Generato da scripts/componenti.mjs: non si ritocca a mano. È Alert di resources/zeiras/bundle.js (il design system di
// Zeiras, copia derivata) in un modulo suo: il suo blocco del bundle e le righe private che usa, riga per riga; i componenti che
// usa li prende da ./componenti. A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { Button, Icon, useLabels } from './componenti';
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  var TONE_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'xCircle' };

  function Alert(p) {
    var tone = p.tone || 'info', C = useLabels();
    return h('div', { className: cx('zr-alert', 'zr-alert-' + tone, p.className), role: tone === 'danger' ? 'alert' : 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 20 }),
      h('div', { className: 'zr-alert-body' }, p.title ? h('strong', null, p.title) : null, p.children ? h('div', null, p.children) : null),
      p.action || null,
      p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }) : null);
  }

export { Alert };
