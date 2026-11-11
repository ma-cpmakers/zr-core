// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Field di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';

  /* ---------- Form ---------- */
  function Field(p) {
    var id = useId('fld');
    var as = p.as || (p.options ? 'select' : 'input');
    var rest = omit(p, ['label', 'hint', 'error', 'as', 'options', 'className', 'icon', 'children', 'required', 'counter']);
    var desc = p.error || p.hint ? id + '-d' : undefined;
    /* counter: quanti caratteri (per code point, come il server) su quanti, da una soglia in su; al limite lo si annuncia (richiesta 55) */
    var cnt = p.counter && p.counter.max ? p.counter : null;
    var cs = useState(function () { return String(p.value != null ? p.value : p.defaultValue != null ? p.defaultValue : ''); });
    var n = cnt ? Array.from(p.value != null ? String(p.value) : cs[0]).length : 0;
    var cid = cnt && n >= (cnt.from || 0) ? id + '-c' : undefined;
    if (cnt) { rest.onChange = function (e) { cs[1](e.target.value); if (p.onChange) p.onChange(e); }; desc = cx(desc, cid) || undefined; }
    /* non controllato: form.reset() cambia il valore senza onChange, e il contatore lo rilegge dal campo */
    useEffect(function () { var el = cnt && p.value == null && document.getElementById(id), f = el && el.form; if (!f) return; function back() { setTimeout(function () { cs[1](el.value); }, 0); } f.addEventListener('reset', back); return function () { f.removeEventListener('reset', back); }; }, [!!cnt, p.value == null]);
    var control;
    if (p.children) control = p.children;
    else if (as === 'select') control = h('div', { className: 'zr-select' }, h('select', Object.assign({ id: id, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest),
      p.options.map(function (o) { var v = typeof o === 'string' ? o : o.value; return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label); })), h(Icon, { name: 'chevronDown', size: 16 }));
    else if (as === 'textarea') control = h('textarea', Object.assign({ id: id, rows: 4, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest));
    else control = h('div', { className: cx('zr-input', p.icon && 'has-icon') }, p.icon ? h(Icon, { name: p.icon, size: 16 }) : null,
      h('input', Object.assign({ id: id, type: 'text', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest)));
    var mid = p.error || p.hint ? id + '-d' : undefined;
    var msg = p.error ? h('p', { id: mid, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
      : p.hint ? h('p', { id: mid, className: 'zr-field-msg' }, p.hint) : null;
    return h('div', { className: cx('zr-field', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      control,
      cnt ? h('div', { className: 'zr-field-foot' }, msg,
        cid ? h('span', { id: cid, className: cx('zr-field-count', n === cnt.max && 'is-full', n > cnt.max && 'is-over') }, n + '/' + cnt.max) : null,
        h('span', { className: 'zr-visually-hidden', 'aria-live': 'polite' }, n >= cnt.max ? (cnt.full || 'Limite raggiunto: {max} caratteri').replace('{max}', function () { return cnt.max; }) : '')) : msg);
  }

export { Field };
