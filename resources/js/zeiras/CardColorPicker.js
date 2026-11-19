// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È CardColorPicker di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useId } from './AppShell';
import { CARD_COLORS } from './CARD_COLORS';
import { CARD_COLOR_TEXTS, cardColorOf } from './interni/CARD_COLOR_TEXTS';
import { useCompLabels } from './interni/useCompLabels';

  function CardColorPicker(p) {
    var id = useId('ccl');
    var names = useCompLabels(CARD_COLOR_TEXTS, p.names);
    var ctrl = p.value !== undefined;
    /* un valore fuori dalla tavolozza (un colore tolto, o di domani) non segna nessuna scelta: anche «Nessuno» resta da scegliere e dà onChange(null) */
    var st = useState(p.defaultValue !== undefined ? cardColorOf(p.defaultValue) : null), val = ctrl ? (p.value != null && !cardColorOf(p.value) ? undefined : cardColorOf(p.value)) : st[0];
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var opts = [null].concat(CARD_COLORS); /* «Nessuno» per primo */
    function pick(c) { if (!ctrl) st[1](c); if (p.onChange) p.onChange(c); }
    /* le frecce le fanno i radio nativi; Home e Fine portano alla prima e all'ultima scelta e la scelgono, come le frecce */
    function onKey(e) {
      if ((e.key !== 'Home' && e.key !== 'End') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !e.target.matches || !e.target.matches('input[type="radio"]')) return;
      var all = e.currentTarget.querySelectorAll('input[type="radio"]:not(:disabled)'); if (!all.length) return;
      var to = all[e.key === 'Home' ? 0 : all.length - 1]; e.preventDefault(); to.focus(); if (!to.checked) pick(to.value || null);
    }
    return h('fieldset', { id: p.id, className: cx('zr-color-picker zr-card-color-picker', p.error && 'is-error', p.className), disabled: p.disabled, 'aria-describedby': desc, 'aria-label': p.label ? undefined : p['aria-label'] },
      p.label ? h('legend', { className: 'zr-field-label' }, p.label) : null,
      h('div', { className: 'zr-color-list', onKeyDown: onKey }, opts.map(function (c) {
        var name = names[c || 'none'];
        return h('label', { key: c || 'none', className: 'zr-color', title: name },
          h('input', { type: 'radio', name: p.name || id, value: c || '', checked: c === val, 'aria-invalid': p.error ? true : undefined,
            onChange: function () { pick(c); } }),
          h('span', { className: cx('zr-color-dot', c ? 'is-card-' + c : 'is-none'), 'aria-hidden': true }),
          h('span', { className: 'zr-visually-hidden' }, name));
      })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

export { CardColorPicker };
