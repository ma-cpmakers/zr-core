// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ToggleGroup di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { countParts } from './interni/countParts';
import { Icon } from './Icon';
import { useId } from './AppShell';

  /* ---------- ToggleGroup: scelte a pulsanti con lo stato premuto, una o più (richiesta 141) ---------- */
  function ToggleGroup(p) {
    var id = useId('tgl');
    var opts = p.options || [];
    var multi = !!p.multiple;
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : (multi ? [] : null)), val = ctrl ? p.value : st[0];
    function isOn(v) { return multi ? (val || []).indexOf(v) >= 0 : val === v; }
    function pick(v) {
      var next;
      if (multi) { var cur = val || []; next = cur.indexOf(v) >= 0 ? cur.filter(function (x) { return x !== v; }) : cur.concat([v]); }
      else if (val === v) { if (!p.allowEmpty) return; next = null; }
      else next = v;
      if (!ctrl) st[1](next);
      if (p.onChange) p.onChange(next);
    }
    var desc = p.error || p.hint ? id + '-d' : undefined;
    return h('div', { id: p.id, className: cx('zr-toggle-field', p.className) },
      p.label ? h('span', { id: id + '-l', className: 'zr-field-label' }, p.label) : null,
      h('div', { role: 'group', className: cx('zr-toggle-group', multi && 'is-multi', p.size === 'sm' && 'is-sm', p.layout === 'grid' && 'is-grid', p.error && 'is-error'),
        'aria-labelledby': p.label ? id + '-l' : undefined, 'aria-label': p.label ? undefined : p['aria-label'], 'aria-describedby': desc },
        opts.map(function (o) {
          var obj = typeof o === 'string' ? { value: o, label: o } : o;
          var on = isOn(obj.value);
          return h('button', { key: obj.value, type: 'button', className: cx('zr-toggle', on && 'is-on'), 'aria-pressed': on, disabled: p.disabled || obj.disabled, 'aria-label': obj['aria-label'], 'aria-describedby': desc, onClick: function () { pick(obj.value); } },
            multi && on && !obj.icon ? h(Icon, { name: 'check', size: 16 }) : obj.icon ? h(Icon, { name: obj.icon, size: 16 }) : null,
            h('span', null, obj.label),
            obj.count != null ? countParts(obj.count, 'zr-toggle-count', obj.countLabel) : null);
        })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

export { ToggleGroup };
