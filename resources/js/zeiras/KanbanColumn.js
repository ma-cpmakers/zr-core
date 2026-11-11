// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È KanbanColumn di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { Button } from './Button';
import { useId } from './AppShell';
import { kanbanTexts, textOf } from './interni/kanbanTexts';
import { besideCard, colCards, roveCards } from './interni/colCards';
import { useEffect } from './interni/useEffect';
import { InlineEdit } from './InlineEdit';
import { Menu } from './Menu';

  function KanbanColumn(p) {
    var count = p.count != null ? p.count : React.Children.count(p.children);
    var lim = p.limit, over = lim && count > lim, full = !over && lim && p.blocks && count == lim, stop = lim && p.blocks && count >= lim; /* con blocks, piena al limite: «Al limite», e «Aggiungi scheda» spento (richiesta 227) */
    var T = kanbanTexts(p.texts);
    var rest = omit(p, ['title', 'count', 'limit', 'children', 'onAdd', 'isOver', 'composer', 'className', 'texts', 'blocks', 'kind', 'threshold', 'rules', 'actions', 'refused', 'handle', 'action', 'editing', 'onEditingChange', 'onRename', 'menuRef', 'transitions', 'cards']);
    var body = useRef(null), cur = useRef(null), hint = useId('zr-keys'), fullId = useId('zr-full');
    var ms = useState(false), menu = ms[0], mb = useRef(null);
    var acts = p.actions && p.actions.length ? p.actions : null;
    var watch = p.kind === 'ready' && p.threshold > 0, below = watch && typeof count === 'number' && count < p.threshold; /* «Pronte» sotto la soglia (richiesta 228) */
    function menuRef(el) { mb.current = el; if (typeof p.menuRef === 'function') p.menuRef(el); }
    useEffect(function () { /* le schede che arrivano, se ne vanno o cambiano posto restano fuori dal Tab, tranne quella corrente */
      var el = body.current; if (!el) return;
      function fix() { cur.current = roveCards(el, cur.current, hint); }
      fix(); var mo = new MutationObserver(fix); mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden'] }); /* anche una scheda che il filtro del modulo nasconde o rimostra */
      return function () { mo.disconnect(); };
    }, []);
    function onFocus(e) { var c = e.target.closest && e.target.closest('.zr-card'); if (c && c !== cur.current && colCards(body.current).indexOf(c) >= 0) cur.current = roveCards(body.current, c, hint); }
    function onKeyDown(e) { /* dopo l'onKeyDown della scheda: un tasto che il modulo ha già usato non si muove */
      var c = e.target, k = e.key; if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || !c.classList || !c.classList.contains('zr-card')) return;
      var cs = colCards(body.current), i = cs.indexOf(c); if (i < 0) return;
      var to = k === 'ArrowDown' ? cs[i + 1] : k === 'ArrowUp' ? cs[i - 1] : k === 'Home' ? cs[0] : k === 'End' ? cs[cs.length - 1] : k === 'ArrowLeft' || k === 'ArrowRight' ? besideCard(body.current, i, k === 'ArrowRight' ? 1 : -1) : undefined;
      if (to === undefined && !/^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(k)) return;
      e.preventDefault(); /* la pagina non scorre, nemmeno in fondo alla lista */
      if (to) to.focus();
    }
    var name = textOf(T.listActions, '{title}', p.title);
    /* il contatore con un limite: «3/5» si vede, il lettore di schermo sente «3 schede su un limite di 5» (richiesta 227) */
    var counter = lim ? [h('span', { key: 'c', className: cx('zr-count', (over || full) && 'is-over'), 'aria-hidden': true, title: textOf(p.blocks ? T.wipBlocks : T.wipLimit, '{n}', lim) }, count + '/' + lim),
      h('span', { key: 's', className: 'zr-visually-hidden' }, textOf(textOf(count == 1 ? T.countOfOne : T.countOf, '{n}', String(count)), '{limit}', String(lim)))]
      : h('span', { className: 'zr-count' }, count);
    return h('section', Object.assign({}, rest, { className: cx('zr-col', p.isOver && !p.refused && 'is-over', p.refused && 'is-refused', p.className), 'aria-label': p.title, 'data-kind': p.kind || undefined }),
      h('header', { className: 'zr-col-head' },
        p.handle || null,
        p.editing && p.onRename ? h(InlineEdit, { label: T.listName, value: p.title, editing: true, onEditingChange: p.onEditingChange, onSave: p.onRename, required: true, maxLength: 60, autoFocus: true }) : h('h3', null, p.title),
        counter,
        over ? h('span', { className: 'zr-col-warn' }, T.overLimit) : full ? h('span', { className: 'zr-col-warn' }, T.full) : null,
        acts ? h('button', { ref: menuRef, type: 'button', className: 'zr-btn zr-btn-ghost zr-btn-sm zr-btn-icon zr-col-menu', 'aria-label': name, 'aria-haspopup': 'menu', 'aria-expanded': menu, onClick: function () { ms[1](!menu); } }, h(Icon, { name: 'more', size: 16 }))
          : h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': name })),
      p.rules && p.rules.length ? h('ul', { className: 'zr-col-rules', 'aria-label': T.rules }, p.rules.map(function (r, i) { return h('li', { key: i }, r.icon ? h(Icon, { name: r.icon, size: 14 }) : null, h('span', null, r.label)); })) : null, /* le regole accese della lista, sotto l'intestazione (richiesta 226) */
      watch ? h('p', { className: below ? 'zr-col-threshold' : 'zr-visually-hidden', role: 'status' }, below ? textOf(textOf(T.belowThreshold, '{n}', String(count)), '{threshold}', String(p.threshold)) : '') : null, /* la zona viva resta montata: cambia solo il testo */
      p.action ? h(Button, { variant: 'secondary', size: 'sm', icon: p.action.icon, className: 'zr-col-action', onClick: p.action.onClick }, p.action.label) : null,
      p.refused ? h('div', { className: 'zr-col-refused' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, T.refused)) : null, /* durante il trascinamento: qui la scheda non entra (richieste 225-227) */
      h('div', { ref: body, className: 'zr-col-body', onFocus: onFocus, onKeyDown: onKeyDown }, p.children),
      h('span', { id: hint, hidden: true }, T.cardKeys), /* letto solo come descrizione delle schede */
      p.composer || h('button', { type: 'button', className: 'zr-col-add', onClick: stop ? undefined : p.onAdd, 'aria-disabled': stop || undefined, 'aria-describedby': stop ? fullId : undefined }, h(Icon, { name: 'plus', size: 16 }), h('span', null, T.addCard)),
      stop ? h('span', { id: fullId, hidden: true }, textOf(textOf(lim == 1 ? T.atLimitOne : T.atLimit, '{list}', p.title), '{n}', String(lim))) : null, /* la lista piena che blocca non prende schede nuove, e dice perché */
      menu && acts ? h(Menu, { anchor: mb.current, align: 'end', label: name, items: acts, onClose: function () { ms[1](false); } }) : null);
  }

export { KanbanColumn };
