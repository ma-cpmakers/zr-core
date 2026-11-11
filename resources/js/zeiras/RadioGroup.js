// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È RadioGroup di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useId } from './AppShell';

  /* ---------- RadioGroup: una scelta fra poche, tutte in vista (richiesta 89) ---------- */
  function RadioGroup(p) {
    var id = useId('rad');
    var opts = p.options || [];
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : null), val = ctrl ? p.value : st[0];
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var card = p.variant === 'card'; /* ogni scelta un riquadro col titolo e la descrizione, anche in griglia (richiesta 177) */
    return h('fieldset', { id: p.id, className: cx('zr-radio-group', p.orientation === 'horizontal' && !card && 'is-horizontal', card && 'is-card', card && p.layout === 'grid' && 'is-grid', p.error && 'is-error', p.className), disabled: p.disabled, 'aria-describedby': desc, 'aria-label': p.label ? undefined : p['aria-label'] },
      p.label ? h('legend', { className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-radio-list' }, opts.map(function (o, i) {
        var obj = typeof o === 'string' ? { value: o, label: o } : o;
        var hid = obj.hint ? id + '-h' + i : undefined, lid = id + '-l' + i; /* il nome è solo l'etichetta: l'aiuto, che sta nella stessa label, è la descrizione */
        return h('label', { key: obj.value, className: cx(card ? 'zr-radio-card' : 'zr-radio', obj.disabled && 'is-disabled') },
          h('input', { type: 'radio', name: p.name || id, value: obj.value, checked: obj.value === val, disabled: obj.disabled, required: p.required, 'aria-invalid': p.error ? true : undefined, 'aria-labelledby': lid, 'aria-describedby': cx(hid, desc) || undefined,
            onChange: function () { if (!ctrl) st[1](obj.value); if (p.onChange) p.onChange(obj.value); } }),
          card ? null : h('span', { className: 'zr-radio-dot', 'aria-hidden': true }),
          card ? h('span', { id: lid, className: 'zr-radio-card-title' }, obj.label) : h('span', { className: 'zr-radio-text' }, h('span', { id: lid }, obj.label), obj.hint ? h('span', { id: hid, className: 'zr-radio-hint' }, obj.hint) : null),
          card && obj.hint ? h('span', { id: hid, className: 'zr-radio-hint' }, obj.hint) : null);
      })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

export { RadioGroup };
