// Generato da scripts/componenti.mjs: non si ritocca a mano. È MentionField di resources/zeiras/bundle.js (il design system di
// Zeiras, copia derivata) in un modulo suo: il suo blocco del bundle e le righe private che usa, riga per riga; i componenti che
// usa li prende da ./componenti. A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { Avatar, Icon, Label } from './componenti';
  var h = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }

  var MENTION_LABELS = { remove: 'Togli', create: 'Crea «{q}» nel CRM', empty: 'Nessun cliente con questo nome', hint: 'Scrivi @ e il nome per scegliere un cliente del CRM', results: 'Clienti del CRM' };
  function MentionField(p) {
    var id = useId('mnt');
    var L = Object.assign({}, MENTION_LABELS, p.labels || {});
    var ctrlVal = p.value !== undefined;
    var vs = useState(p.defaultValue || []), values = ctrlVal ? p.value : vs[0];
    var ts = useState(p.defaultQuery != null ? '@' + p.defaultQuery : ''), text = p.query != null ? '@' + p.query : ts[0];
    var os = useState(!!p.defaultOpen), open = p.open !== undefined ? p.open : os[0];
    var as = useState(0), active = as[0];
    var multiple = p.multiple !== false;
    var at = text.lastIndexOf('@');
    var q = at >= 0 ? text.slice(at + 1).trim().toLowerCase() : null;
    var taken = values.map(function (v) { return v.id; });
    var list = q === null ? [] : (p.suggestions || []).filter(function (s) {
      if (taken.indexOf(s.id) >= 0) return false;
      var hay = [s.name, s.email, s.phone, s.sub].filter(Boolean).join(' ').toLowerCase();
      return !q || hay.indexOf(q) >= 0;
    }).slice(0, p.maxResults || 8);
    var canCreate = !!(p.onCreate || p.createLabel) && q;
    var count = list.length + (canCreate ? 1 : 0);
    var showList = open && q !== null;
    function setText(t) { if (p.query == null) ts[1](t); var i = t.lastIndexOf('@'); if (p.onQuery) p.onQuery(i >= 0 ? t.slice(i + 1) : null); if (p.open === undefined) os[1](i >= 0); as[1](0); }
    function setValues(v) { if (!ctrlVal) vs[1](v); if (p.onChange) p.onChange(v); }
    function pick(s) { setValues(multiple ? values.concat([s]) : [s]); setText(at >= 0 ? text.slice(0, at) : ''); if (p.open === undefined) os[1](false); }
    function create() { var name = text.slice(at + 1).trim(); if (p.onCreate) p.onCreate(name); setText(text.slice(0, at)); }
    function remove(v) { setValues(values.filter(function (x) { return x.id !== v.id; })); }
    function onKey(e) {
      if (e.key === 'Backspace' && !text && values.length) { remove(values[values.length - 1]); return; }
      if (!showList || !count) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); as[1]((active + 1) % count); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); as[1]((active - 1 + count) % count); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active < list.length) pick(list[active]); else create(); }
      else if (e.key === 'Escape') { e.preventDefault(); if (p.open === undefined) os[1](false); }
    }
    var desc = p.error || p.hint !== false ? id + '-d' : undefined;
    return h('div', { className: cx('zr-field', 'zr-mention', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-mention-anchor' },
      h('div', { className: 'zr-mention-box' },
        values.map(function (v) {
          return h('span', { key: v.id, className: 'zr-mention-chip' }, h(Avatar, { name: v.name, size: 'sm' }), h('span', { className: 'zr-mention-chip-name' }, v.name),
            h('button', { type: 'button', className: 'zr-mention-x', 'aria-label': L.remove + ' ' + v.name, onClick: function () { remove(v); } }, h(Icon, { name: 'close', size: 14 })));
        }),
        h('input', { id: id, type: 'text', value: text, placeholder: values.length ? '' : (p.placeholder || '@nome'), autoComplete: 'off', role: 'combobox',
          'aria-expanded': showList, 'aria-controls': id + '-l', 'aria-autocomplete': 'list', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined,
          'aria-activedescendant': showList && count ? id + '-o' + active : undefined,
          onChange: function (e) { setText(e.target.value); }, onKeyDown: onKey,
          onBlur: function () { if (p.open === undefined) setTimeout(function () { os[1](false); }, 120); } })),
      showList ? h('ul', { id: id + '-l', role: 'listbox', className: 'zr-mention-list', 'aria-label': L.results },
        list.map(function (s, i) {
          return h('li', { key: s.id, id: id + '-o' + i, role: 'option', 'aria-selected': i === active, className: cx('zr-mention-opt', i === active && 'is-active'),
            onMouseDown: function (e) { e.preventDefault(); pick(s); }, onMouseEnter: function () { as[1](i); } },
            h(Avatar, { name: s.name, size: 'md' }),
            h('span', { className: 'zr-mention-opt-text' }, h('strong', null, s.name), h('span', null, [s.email, s.sub].filter(Boolean).join(' · '))),
            s.tag ? h(Label, { tone: s.tagTone || 'neutral' }, s.tag) : null);
        }),
        canCreate ? h('li', { id: id + '-o' + list.length, role: 'option', 'aria-selected': active === list.length, className: cx('zr-mention-opt', 'is-create', active === list.length && 'is-active'),
          onMouseDown: function (e) { e.preventDefault(); create(); } },
          h('span', { className: 'zr-mention-plus', 'aria-hidden': true }, h(Icon, { name: 'plus', size: 16 })),
          h('span', { className: 'zr-mention-opt-text' }, h('strong', null, (p.createLabel || L.create).replace('{q}', text.slice(at + 1).trim())))) : null,
        !count ? h('li', { className: 'zr-mention-empty', role: 'option', 'aria-disabled': true }, L.empty) : null) : null),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint !== false ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint || L.hint) : null);
  }

export { MentionField };
