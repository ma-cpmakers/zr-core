// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Checkbox di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';

  function Checkbox(p) {
    var id = useId('chk');
    var rest = omit(p, ['label', 'className', 'indeterminate', 'hint', 'error']);
    var ref = useRef(null);
    useEffect(function () { if (ref.current) ref.current.indeterminate = !!p.indeterminate; });
    var desc = p.error || p.hint ? id + '-d' : undefined; /* aiuto ed errore sotto, come Field (richiesta 144) */
    var wrap = 'hint' in p || 'error' in p; /* dalle props passate, non dal valore: l'errore che sparisce non rimonta la casella */
    var box = h('label', { className: cx('zr-check', p.error && 'is-error', !wrap && p.className) },
      h('input', Object.assign({ type: 'checkbox', ref: ref, 'aria-describedby': desc, 'aria-invalid': p.error ? true : undefined }, rest)),
      h('span', { className: 'zr-check-box', 'aria-hidden': true }, h(Icon, { name: p.indeterminate ? 'close' : 'check', size: 14 })),
      p.label ? h('span', null, p.label) : null);
    if (!wrap) return box;
    return h('div', { className: cx('zr-check-field', p.className) }, box,
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

export { Checkbox };
