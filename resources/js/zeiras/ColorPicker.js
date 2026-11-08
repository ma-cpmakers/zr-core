// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ColorPicker di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { TONES } from './interni/TONES';
import { useId } from './AppShell';
import { COLOR_TEXTS } from './interni/COLOR_TEXTS';
import { useCompLabels } from './interni/useCompLabels';

  function ColorPicker(p) {
    var id = useId('clr');
    var tones = (p.tones || ['pine', 'citrus', 'coral', 'sky', 'plum']).filter(function (t) { return TONES.indexOf(t) >= 0; });
    var names = useCompLabels(COLOR_TEXTS, p.names);
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : null), val = ctrl ? p.value : st[0];
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var opts = (p.none ? [null] : []).concat(tones); /* null = nessun colore */
    return h('fieldset', { id: p.id, className: cx('zr-color-picker', p.error && 'is-error', p.className), disabled: p.disabled, 'aria-describedby': desc, 'aria-label': p.label ? undefined : p['aria-label'] },
      p.label ? h('legend', { className: 'zr-field-label' }, p.label) : null,
      h('div', { className: 'zr-color-list' }, opts.map(function (t) {
        var name = t ? names[t] : p.none;
        return h('label', { key: t || 'none', className: 'zr-color', title: name },
          h('input', { type: 'radio', name: p.name || id, value: t || '', checked: t === val, 'aria-invalid': p.error ? true : undefined,
            onChange: function () { if (!ctrl) st[1](t); if (p.onChange) p.onChange(t); } }),
          h('span', { className: cx('zr-color-dot', t ? 'is-' + t : 'is-none'), 'aria-hidden': true }),
          h('span', { className: 'zr-visually-hidden' }, name));
      })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

export { ColorPicker };
