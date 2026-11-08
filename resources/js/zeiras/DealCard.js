// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DealCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { KANBAN_TEXTS } from './KANBAN_TEXTS';
import { dealMoney } from './interni/MONEY';
import { Menu } from './Menu';

  function DealCard(p) {
    var rest = omit(p, ['title', 'company', 'companyIcon', 'amount', 'amountText', 'formatAmount', 'currency', 'owner', 'probability', 'age', 'ageLabel', 'ageTitle', 'dragging', 'className', 'actions', 'actionsLabel', 'busy']);
    var cIcon = p.companyIcon === undefined ? 'building' : p.companyIcon;
    var ms = useState(false), menu = ms[0], btn = useRef(null), kb = useRef(false);
    var acts = p.actions && p.actions.length && !p.busy ? p.actions : null, name = p.actionsLabel || KANBAN_TEXTS.cardActions;
    /* il «⋯» delle azioni, come in KanbanCard (richiesta 157): fuori dal Tab, dalla scheda con «.», Maiusc+F10 o il tasto Menu; al tocco su 44 px (richiesta 1) */
    if (acts) rest.onKeyDown = function (e) {
      if (e.target === e.currentTarget && (e.key === '.' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); kb.current = true; ms[1](true); return; }
      if (p.onKeyDown) p.onKeyDown(e);
    };
    /* busy: lo spostamento aspetta il modulo; la scheda si vede occupata e non si trascina */
    if (p.busy) rest = Object.assign(rest, { 'aria-busy': true, draggable: false });
    var card = h('article', Object.assign({ tabIndex: 0, 'aria-keyshortcuts': acts ? '. Shift+F10' : undefined }, rest, { className: cx('zr-card zr-deal', p.dragging && 'is-dragging', acts && 'has-actions', acts && !p.owner && 'is-ownerless', p.busy && 'is-busy', p.className) }),
      acts ? h('button', { ref: btn, type: 'button', tabIndex: -1, draggable: false, className: 'zr-card-actions', 'aria-label': name, 'aria-haspopup': 'menu', 'aria-expanded': menu,
        onMouseDown: function (e) { e.stopPropagation(); }, onClick: function (e) { e.stopPropagation(); kb.current = false; ms[1](!menu); } }, h(Icon, { name: 'more', size: 16 })) : null,
      h('div', { className: 'zr-deal-top' }, p.company ? h('span', { className: 'zr-deal-company' }, cIcon ? h(Icon, { name: cIcon, size: 14 }) : null, p.company) : h('span', null),
        p.busy ? h('span', { className: 'zr-btn-spin zr-deal-spin', 'aria-hidden': true }) : p.owner ? h(Avatar, { name: p.owner, size: 'sm' }) : null),
      h('h4', { className: 'zr-card-title' }, p.title),
      h('div', { className: 'zr-deal-foot' },
        h('strong', { className: 'zr-deal-amount' }, p.amountText != null ? p.amountText : dealMoney(p)), /* l'importo già scritto dal modulo, nella sua valuta e lingua (richiesta 68) */
        h('span', { className: 'zr-card-meta' }, p.probability != null ? h('span', { className: 'zr-meta' }, h(Icon, { name: 'target', size: 14 }), p.probability + '%') : null,
          p.age ? h('span', { className: cx('zr-meta', p.age > 14 && 'is-overdue'), title: p.ageTitle || 'Giorni in questa fase' }, h(Icon, { name: 'clock', size: 14 }), p.age + ' ' + (p.ageLabel || 'gg')) : null)));
    return acts ? h(React.Fragment, null, card, menu ? h(Menu, { anchor: btn.current, align: 'end', label: name, items: acts, onClose: function () { ms[1](false); var a = kb.current && btn.current && btn.current.parentNode, b = btn.current; if (a) queueMicrotask(function () { var x = document.activeElement; if (document.contains(a) && (!x || x === document.body || x === b)) a.focus(); }); } }) : null) : card;
  }

export { DealCard };
