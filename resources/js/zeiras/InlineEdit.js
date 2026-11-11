// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È InlineEdit di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';
import { INLINE_EDIT_TEXTS } from './interni/INLINE_EDIT_TEXTS';
import { useCompLabels } from './interni/useCompLabels';

  function InlineEdit(p) {
    var id = useId('ied');
    var L = useCompLabels(INLINE_EDIT_TEXTS, p.labels);
    var value = p.value == null ? '' : String(p.value);
    /* as="select": una scelta fra opzioni, che salva appena scelta; in vista il nome dell'opzione. format: come si vede un valore (una data) (richiesta 184) */
    var sel = p.as === 'select', opts = (p.options || []).map(function (o) { return typeof o === 'string' ? { value: o, label: o } : o; });
    function shown(v) { if (sel) { for (var i = 0; i < opts.length; i++) if (opts[i].value === v) return opts[i].label; } return v && p.format ? p.format(v) : v; }
    var ctrl = p.editing !== undefined; /* editing controllato da chi usa il componente («Rinomina» in un menu), con onEditingChange */
    var es = useState(ctrl ? !!p.editing : !!p.defaultEditing), editing = ctrl ? !!p.editing : es[0];
    var ds = useState(value), draft = ds[0];
    var ss = useState('idle'), stato = ss[0]; /* idle · saving · saved · error */
    var ms = useState(''), msg = ms[0];
    var mode = useRef(editing ? 'edit' : 'view'), mounted = useRef(false), viewRef = useRef(null), fieldRef = useRef(null), timer = useRef(null), alive = useRef(true), back = useRef(false), ptr = useRef(false);
    useEffect(function () { alive.current = true; return function () { alive.current = false; clearTimeout(timer.current); }; }, []);
    /* saveOnUnmount: smontato col campo aperto, la bozza cambiata si salva una volta, se è valida e non è appena stata rifiutata (richiesta 193); nel cleanup del layout il campo c'è ancora */
    var last = useRef(null); last.current = { p: p, draft: draft, value: value, stato: stato };
    React.useLayoutEffect(function () { return function () {
      var l = last.current, q = l.p, f = fieldRef.current, vd = f && f.validity;
      if (!q.saveOnUnmount || !q.onSave || mode.current !== 'edit' || l.stato === 'error' || (vd && (vd.badInput || vd.typeMismatch))) return;
      var next = q.trim === false || q.as === 'select' ? l.draft : l.draft.trim();
      if (next === l.value || !next.trim() && (q.cancelOnEmpty || q.required) || (q.validate && q.validate(next))) return;
      try { var r = q.onSave(next); if (r && typeof r.then === 'function') r.then(null, function () {}); } catch (e) {} /* l'errore non ha più dove mostrarsi: lo gestisce chi usa il componente */
    }; }, []);
    /* aperto o chiuso da fuori: si riparte dal valore, e chiuso da fuori non salva */
    var pe = useState(editing);
    if (pe[0] !== editing) {
      pe[1](editing);
      if (editing && mode.current === 'view') { mode.current = 'edit'; ds[1](value); ss[1]('idle'); ms[1](''); }
      else if (!editing && mode.current === 'edit') { mode.current = 'view'; ss[1]('idle'); ms[1](''); }
    }
    useEffect(function () {
      var first = !mounted.current; mounted.current = true;
      if (editing && fieldRef.current && (!first || p.autoFocus)) { fieldRef.current.focus(); if (typeof fieldRef.current.select === 'function') fieldRef.current.select(); }
      if (!editing && back.current) { back.current = false; if (viewRef.current) viewRef.current.focus(); }
    }, [editing]);
    function setEditing(v) { if (!ctrl) es[1](v); if (p.onEditingChange) p.onEditingChange(v); }
    function close(focusBack) { mode.current = 'view'; back.current = focusBack; setEditing(false); }
    function start() { if (p.disabled) return; clearTimeout(timer.current); mode.current = 'edit'; ds[1](value); ss[1]('idle'); ms[1](''); setEditing(true); }
    function fail(m) { mode.current = 'edit'; ss[1]('error'); ms[1](m || L.error); }
    function save(focusBack, v) {
      if (mode.current !== 'edit') return;
      var src = v != null ? v : draft, next = p.trim === false || sel ? src : src.trim();
      var vd = fieldRef.current && fieldRef.current.validity; /* un numero, una data o un'email che il browser non accetta: il campo vale "" o il testo com'è, e non si salva; un valore arrivato così e non toccato si lascia */
      if (vd && (vd.badInput || (vd.typeMismatch && next !== value))) { fail(L.invalid); return; }
      if (next === value || (p.cancelOnEmpty && !next.trim())) { ss[1]('idle'); close(focusBack); return; } /* cancelOnEmpty: il vuoto annulla e torna il valore di prima */
      if (p.required && !next) { fail(L.required); return; }
      var bad = p.validate ? p.validate(next) : null;
      if (bad) { fail(bad); return; }
      mode.current = 'saving'; ss[1]('saving'); ms[1]('');
      Promise.resolve().then(function () { return p.onSave ? p.onSave(next) : undefined; }).then(function () {
        if (!alive.current) return;
        close(focusBack && document.activeElement === fieldRef.current); ss[1]('saved'); /* il fuoco torna solo se è ancora nel campo */
        timer.current = setTimeout(function () { if (alive.current) ss[1](function (s) { return s === 'saved' ? 'idle' : s; }); }, 2500);
      }, function (e) { if (alive.current) fail(e && e.message); });
    }
    /* il tetto in caratteri, non in unità UTF-16 (richiesta 182), come maxlength: dell'inserimento entra ciò che ci sta, il resto del testo non si tocca, e un valore già oltre il tetto si può accorciare */
    function cap(v, prev, el) {
      var a = Array.from(v), b = Array.from(prev);
      if (!p.maxLength || a.length <= p.maxLength || a.length <= b.length) return v;
      var i = 0, j = 0, end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : -1;
      if (end >= 0) j = Math.min(b.length, Array.from(v.slice(end)).length); /* dopo il cursore c'è ciò che c'era dopo l'inserimento */
      else while (j < b.length && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
      while (i < b.length - j && a[i] === b[i]) i++;
      var put = a.slice(i, a.length - j).slice(0, Math.max(0, p.maxLength - i - j)), head = a.slice(0, i).concat(put).join('');
      var out = head + a.slice(a.length - j).join('');
      if (el) { el.value = out; try { el.setSelectionRange(head.length, head.length); } catch (e) {} } /* il cursore resta dopo ciò che è entrato */
      return out;
    }
    var pre = useRef('');
    function onKey(e) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return; /* Invio ed Esc dell'IME confermano o annullano la composizione (richiesta 181) */
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (mode.current !== 'saving') { ss[1]('idle'); close(true); } }
      else if (e.key === 'Enter' && (!p.multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); save(true); }
    }
    var size = p.size === 'title' ? 'title' : 'body';
    var errId = id + '-e', keysId = id + '-k';
    var body;
    if (editing) {
      var attrs = { ref: fieldRef, id: id, value: draft, className: 'zr-inline-edit-field', 'aria-label': p.label, 'aria-invalid': stato === 'error' || undefined, 'aria-busy': stato === 'saving' || undefined,
        'aria-describedby': cx(stato === 'error' && errId, keysId), readOnly: stato === 'saving', placeholder: p.placeholder,
        onChange: function (e) { ds[1](e.nativeEvent.isComposing ? e.target.value : cap(e.target.value, draft, e.target)); if (stato === 'error') { ss[1]('idle'); ms[1](''); } },
        onCompositionStart: function () { pre.current = draft; }, onCompositionEnd: function (e) { ds[1](cap(e.target.value, pre.current, e.target)); }, onKeyDown: onKey, onBlur: function () { save(false); } };
      /* la scelta col puntatore salva subito; con la tastiera le frecce la spostano (su Windows e Linux cambiano la select chiusa) e Invio o l'uscita salvano; mentre salva è ferma */
      var busy = stato === 'saving', known = opts.some(function (o) { return o.value === draft; });
      body = sel ? h('span', { className: 'zr-inline-edit-select' }, h('select', Object.assign({}, attrs, { readOnly: undefined, placeholder: undefined, onCompositionStart: undefined, onCompositionEnd: undefined, 'aria-disabled': busy || undefined,
          onPointerDown: function () { ptr.current = true; }, onMouseDown: function (e) { if (busy) e.preventDefault(); },
          onKeyDown: function (e) { ptr.current = false; if (busy && e.key !== 'Tab') { e.preventDefault(); return; } onKey(e); },
          onChange: function (e) { if (mode.current !== 'edit') return; ds[1](e.target.value); if (ptr.current) save(true, e.target.value); } }),
          known ? null : h('option', { value: draft, disabled: true }, draft || p.placeholder || L.empty), /* senza valore, o con uno che non è fra le opzioni, nessuna opzione vera è già scelta */
          opts.map(function (o) { return h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label); })), h(Icon, { name: 'chevronDown', size: 16 }))
        : p.multiline ? h('textarea', Object.assign({ rows: p.rows || 3 }, attrs)) : h('input', Object.assign({ type: p.type || 'text' }, attrs));
    } else {
      body = h('button', { ref: viewRef, type: 'button', className: cx('zr-inline-edit-view', !value && 'is-empty'), disabled: p.disabled, onClick: start,
        'aria-label': L.edit + ': ' + p.label + (value ? ', ' + shown(value) : '') },
        h('span', { className: 'zr-inline-edit-text' }, value && p.view ? p.view(value) : shown(value) || p.placeholder || L.empty), p.disabled ? null : h(Icon, { name: 'edit', size: 14 }));
      /* view: come si vede il valore dentro il pulsante; actions: accanto, fuori dal clic che apre il campo (un link, «Chiama») (richiesta 192) */
      if (p.actions) body = h('div', { className: 'zr-inline-edit-row' }, body, h('span', { className: 'zr-inline-edit-actions' }, p.actions));
    }
    return h('div', { className: cx('zr-inline-edit', 'is-' + size, editing && 'is-editing', stato === 'error' && 'is-error', p.multiline && 'is-multiline', p.className) },
      body,
      editing && stato === 'error' ? h('p', { id: errId, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), msg) : null,
      editing ? h('p', { id: keysId, className: 'zr-inline-edit-keys' }, p.multiline ? L.keysMultiline : L.keys) : null,
      h('p', { className: cx('zr-inline-edit-status', stato === 'saved' && 'is-saved'), role: 'status' },
        stato === 'saving' ? L.saving : stato === 'saved' ? [h(Icon, { key: 'i', name: 'check', size: 14 }), h('span', { key: 't' }, L.saved)] : null));
  }

export { InlineEdit };
