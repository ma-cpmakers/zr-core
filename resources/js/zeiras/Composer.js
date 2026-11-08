// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Composer di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { useId } from './AppShell';
import { useLabels } from './useLabels';

  /* ---------- Composer (P-15: creazione in linea) ---------- */
  function Composer(p) {
    var id = useId('cmp'), C = useLabels();
    var st = useState(p.defaultValue || ''), v = st[0], set = st[1];
    var bs = useState(false), busy = bs[0];
    /* il testo resta finché la creazione non riesce: onCreate che torna false, o una Promise rifiutata o risolta a false, lo lascia nel campo (richiesta 156) */
    function submit() {
      var t = v.trim(); if (!t) { if (p.onCancel) p.onCancel(); return; }
      if (busy) return;
      var r = p.onCreate ? p.onCreate(t) : undefined; /* riuscita, si svuota solo se nel frattempo non si è scritto altro */
      if (r === false) return;
      if (r && typeof r.then === 'function') { bs[1](true); r.then(function (ok) { bs[1](false); if (ok !== false) set(function (cur) { return cur.trim() === t ? '' : cur; }); }, function () { bs[1](false); }); return; }
      set('');
    }
    var eid = p.error ? id + '-e' : undefined;
    return h('div', { className: cx('zr-composer', p.error && 'is-error', p.className) },
      h('textarea', { autoFocus: p.autoFocus !== false, rows: p.rows || (p.multiline ? 2 : 1), value: v, placeholder: p.placeholder, maxLength: p.maxLength, 'aria-label': p.label || p.placeholder, 'aria-invalid': p.error ? true : undefined, 'aria-describedby': eid,
        onChange: function (e) { set(p.multiline ? e.target.value : e.target.value.replace(/\n/g, '')); },
        onKeyDown: function (e) { if (e.key === 'Enter' && !(p.multiline && e.shiftKey)) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); set(''); if (p.onCancel) p.onCancel(); } } }),
      p.error ? h('p', { id: eid, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error) : null,
      h('div', { className: 'zr-composer-row' },
        h(Button, { size: 'sm', busy: busy, onClick: submit }, p.submitLabel || C.add),
        h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': p.closeLabel || C.cancel, onClick: function () { set(''); if (p.onCancel) p.onCancel(); } })));
  }

export { Composer };
