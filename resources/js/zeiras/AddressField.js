// Generato da scripts/componenti.mjs: non si ritocca a mano. È AddressField di resources/zeiras/bundle.js (il design system di
// Zeiras, copia derivata) in un modulo suo: il suo blocco del bundle e le righe private che usa, riga per riga; i componenti che
// usa li prende da ./componenti. A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { Icon, Label } from './componenti';
import '../../css/zeiras/MentionField.css';
import '../../css/zeiras/AddressField.css';
  var h = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }

  /* ---------- AddressField: indirizzo con autocompletamento (Google Places) ---------- */
  var ADDRESS_LABELS = { results: 'Suggerimenti', empty: 'Nessun suggerimento: puoi salvare il testo com’è', hint: 'Scrivi una città o un indirizzo completo', attribution: 'Suggerimenti di Google', city: 'Città', address: 'Indirizzo', freeText: 'Testo libero, non verificato', clear: 'Cancella l’indirizzo' };
  function AddressField(p) {
    var id = useId('adr');
    var L = Object.assign({}, ADDRESS_LABELS, p.labels || {});
    var ctrl = p.value !== undefined;
    var vs = useState(p.defaultValue || ''), text = ctrl ? (p.value || '') : vs[0];
    var ps = useState(p.defaultPlace || null), place = p.place !== undefined ? p.place : ps[0];
    var os = useState(!!p.defaultOpen), open = p.open !== undefined ? p.open : os[0];
    var as = useState(0), active = as[0];
    var q = text.trim().toLowerCase();
    var list = q.length < (p.minChars || 2) || (place && place.label === text) ? [] : (p.suggestions || []).filter(function (s) {
      if (p.onQuery) return true;
      return [s.main, s.secondary].filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
    }).slice(0, p.maxResults || 4);
    var showList = open && q.length >= (p.minChars || 2) && !(place && place.label === text);
    function setText(t) { if (!ctrl) vs[1](t); if (p.onChange) p.onChange(t); if (p.onQuery) p.onQuery(t); if (p.place === undefined) ps[1](null); if (p.onSelect && place) p.onSelect(null); if (p.open === undefined) os[1](true); as[1](0); }
    function pick(s) {
      var label = [s.main, s.secondary].filter(Boolean).join(', ');
      var pl = Object.assign({}, s, { label: label });
      if (!ctrl) vs[1](label); if (p.onChange) p.onChange(label);
      if (p.place === undefined) ps[1](pl); if (p.onSelect) p.onSelect(pl);
      if (p.open === undefined) os[1](false);
    }
    function onKey(e) {
      if (!showList || !list.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); as[1]((active + 1) % list.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); as[1]((active - 1 + list.length) % list.length); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(list[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); if (p.open === undefined) os[1](false); }
    }
    var desc = id + '-d';
    var status = place ? (place.kind === 'citta' ? L.city : L.address) + ' · ' + place.label : (text.trim() && !showList ? L.freeText : '');
    return h('div', { className: cx('zr-field', 'zr-address', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-mention-anchor' },
        h('label', { className: 'zr-input has-icon zr-address-box' }, h(Icon, { name: place ? 'checkCircle' : 'search', size: 16 }),
          h('input', { id: id, type: 'text', value: text, placeholder: p.placeholder || 'Es. Arezzo oppure Via Roma 4, Arezzo', autoComplete: 'off', role: 'combobox',
            'aria-expanded': showList, 'aria-controls': id + '-l', 'aria-autocomplete': 'list', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined,
            'aria-activedescendant': showList && list.length ? id + '-o' + active : undefined,
            onChange: function (e) { setText(e.target.value); }, onKeyDown: onKey, onFocus: function () { if (p.open === undefined) os[1](true); },
            onBlur: function () { if (p.open === undefined) setTimeout(function () { os[1](false); }, 120); } }),
          text ? h('button', { type: 'button', className: 'zr-mention-x', 'aria-label': L.clear, onClick: function () { setText(''); } }, h(Icon, { name: 'close', size: 14 })) : null),
        showList ? h('ul', { id: id + '-l', role: 'listbox', className: 'zr-mention-list zr-address-list', 'aria-label': L.results },
          list.map(function (s, i) {
            return h('li', { key: s.id, id: id + '-o' + i, role: 'option', 'aria-selected': i === active, className: cx('zr-mention-opt', i === active && 'is-active'),
              onMouseDown: function (e) { e.preventDefault(); pick(s); }, onMouseEnter: function () { as[1](i); } },
              h('span', { className: 'zr-address-ico', 'aria-hidden': true }, h(Icon, { name: s.kind === 'citta' ? 'globe' : 'home', size: 16 })),
              h('span', { className: 'zr-mention-opt-text' }, h('strong', null, s.main), s.secondary ? h('span', null, s.secondary) : null),
              h(Label, { tone: s.kind === 'citta' ? 'sky' : 'neutral' }, s.kind === 'citta' ? L.city : L.address));
          }),
          !list.length ? h('li', { className: 'zr-mention-empty', role: 'option', 'aria-disabled': true }, L.empty) : null,
          p.attribution !== false ? h('li', { className: 'zr-address-attr', role: 'presentation', 'aria-hidden': true }, L.attribution) : null) : null),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : h('p', { id: desc, className: cx('zr-field-msg', place && 'zr-address-ok') }, status || p.hint || L.hint));
  }

export { AddressField };
