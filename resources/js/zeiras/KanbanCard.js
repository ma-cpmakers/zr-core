// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È KanbanCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { Label } from './Label';
import { AvatarStack } from './AvatarStack';
import { kanbanTexts, textOf } from './interni/kanbanTexts';
import { Menu } from './Menu';

  function KanbanCard(p) {
    var T = kanbanTexts(p.texts);
    var cl = p.checklist;
    var done = cl && cl.total > 0 && cl.done >= cl.total;
    var ms = useState(false), menu = ms[0], btn = useRef(null), kb = useRef(false);
    var acts = p.actions && p.actions.length ? p.actions : null;
    var rest = omit(p, ['title', 'number', 'labels', 'due', 'overdue', 'checklist', 'comments', 'assignees', 'cover', 'dragging', 'className', 'texts', 'actions', 'actionsLabel', 'votes']);
    /* il voto anonimo della retrospettiva: quanti e «hai votato», il pulsante premuto; senza onToggle solo il numero (richiesta 170) */
    var vt = p.votes, vn = vt ? Math.max(0, vt.count || 0) : 0, vs = vt ? (vn === 1 ? T.oneVote : textOf(T.votes, '{n}', String(vn))) : '';
    var vote = !vt ? null : vt.onToggle ? h('button', { type: 'button', draggable: false, className: 'zr-card-vote', 'aria-pressed': vt.mine ? 'true' : 'false', 'aria-label': T.vote + ': ' + vs, title: vt.mine ? T.unvote : T.vote,
        onKeyDown: function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.stopPropagation(); if (e.repeat) e.preventDefault(); } }, /* Invio e Spazio sono del voto, non della scheda; tenuti premuti non votano a ripetizione. Gli altri tasti passano */
        onClick: function (e) { e.stopPropagation(); vt.onToggle(); } }, h(Icon, { name: vt.mine ? 'check' : 'chevronUp', size: 14 }), h('span', { 'aria-hidden': true }, vn))
      : h('span', { className: cx('zr-meta', vt.mine && 'is-voted'), title: vt.mine ? vs + ', ' + T.voted : vs }, h(Icon, { name: vt.mine ? 'check' : 'chevronUp', size: 14 }), h('span', { 'aria-hidden': true }, vn), h('span', { className: 'zr-visually-hidden' }, vt.mine ? vs + ', ' + T.voted : vs));
    /* il «⋯» delle azioni rapide: fuori dal Tab, si apre anche dalla scheda con «.», Maiusc+F10 o il tasto Menu (richiesta 157) */
    if (acts) rest.onKeyDown = function (e) {
      if (e.target === e.currentTarget && (e.key === '.' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); kb.current = true; ms[1](true); return; }
      if (p.onKeyDown) p.onKeyDown(e);
    };
    /* il menu sta accanto alla scheda, non dentro: un clic su una voce non apre la scheda */
    var card = h('article', Object.assign({ tabIndex: 0, 'aria-keyshortcuts': acts ? '. Shift+F10' : undefined }, rest, { className: cx('zr-card', p.dragging && 'is-dragging', acts && 'has-actions', p.className) }),
      acts ? h('button', { ref: btn, type: 'button', tabIndex: -1, draggable: false, className: 'zr-card-actions', 'aria-label': p.actionsLabel || T.cardActions, 'aria-haspopup': 'menu', 'aria-expanded': menu,
        onMouseDown: function (e) { e.stopPropagation(); }, onClick: function (e) { e.stopPropagation(); kb.current = false; ms[1](!menu); } }, h(Icon, { name: 'more', size: 16 })) : null,
      p.cover ? h('div', { className: cx('zr-card-cover', 'zr-cover-' + p.cover) }) : null,
      p.labels && p.labels.length ? h('div', { className: 'zr-card-labels' }, p.labels.map(function (l, i) { return h(Label, { key: i, tone: l.tone }, l.text); })) : null,
      h('h4', { className: 'zr-card-title' }, p.number != null && p.number !== '' ? h('span', { className: 'zr-card-num' }, '#' + p.number + ' ') : null, p.title), /* il numero della scheda davanti al titolo, in grigio: per cercarla e citarla (richiesta 209) */
      (p.due || cl || p.comments || vote || (p.assignees && p.assignees.length)) ? h('div', { className: 'zr-card-meta' },
        p.due ? h('span', { className: cx('zr-meta', p.overdue && 'is-overdue') }, h(Icon, { name: p.overdue ? 'clock' : 'calendar', size: 14 }), p.overdue ? textOf(T.overdue, '{date}', p.due) : p.due) : null,
        cl ? h('span', { className: cx('zr-meta', done && 'is-done'), title: T.checklist }, h(Icon, { name: 'checklist', size: 14 }), cl.done + '/' + cl.total) : null,
        p.comments ? h('span', { className: 'zr-meta', title: T.comments }, h(Icon, { name: 'message', size: 14 }), p.comments) : null,
        vote,
        p.assignees && p.assignees.length ? h('span', { className: 'zr-card-people' }, h(AvatarStack, { people: p.assignees, max: 3 })) : null) : null);
    return acts ? h(React.Fragment, null, card, menu ? h(Menu, { anchor: btn.current, align: 'end', label: p.actionsLabel || T.cardActions, items: acts, onClose: function () { ms[1](false); var a = kb.current && btn.current && btn.current.parentNode, b = btn.current; if (a) queueMicrotask(function () { var x = document.activeElement; if (document.contains(a) && (!x || x === document.body || x === b)) a.focus(); }); } }) : null) : card; /* aperto dalla scheda con la tastiera, il fuoco torna alla scheda (dopo quello che il Menu rende al «⋯»), se la voce scelta non l'ha portato altrove */
  }

export { KanbanCard };
