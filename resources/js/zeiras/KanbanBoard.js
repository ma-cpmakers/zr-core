// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È KanbanBoard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { AvatarStack } from './AvatarStack';
import { useId } from './AppShell';
import { kanbanTexts, textOf } from './interni/kanbanTexts';
import { KanbanCard } from './KanbanCard';
import { KanbanColumn } from './KanbanColumn';
import { AddList } from './AddList';
import { useEffect } from './interni/useEffect';
import { useLabels } from './useLabels';
import { Menu } from './Menu';

  /* ---------- KanbanBoard ---------- */
  var SAMPLE_LISTS = [
    { id: 'todo', title: 'Da fare', cards: [
      { id: 'c1', title: 'Definire gli obiettivi del corso', labels: [{ text: 'Strategia', tone: 'plum' }], due: '3 ott', checklist: { done: 1, total: 4 }, assignees: ['Luciano Castro'] },
      { id: 'c2', title: 'Raccogliere testimonianze degli ex corsisti', labels: [{ text: 'Marketing', tone: 'sky' }], comments: 2, assignees: ['Costanza Rossi', 'Marco Neri'] },
      { id: 'c3', title: 'Preventivo per lo studio di registrazione', due: '25 set', overdue: true, labels: [{ text: 'Urgente', tone: 'coral' }] }
    ] },
    { id: 'doing', title: 'In corso', limit: 3, cards: [
      { id: 'c4', title: 'Scrivere la scaletta del modulo 2', cover: 'citrus', labels: [{ text: 'Contenuti', tone: 'citrus' }], due: '1 ott', checklist: { done: 3, total: 5 }, comments: 4, assignees: ['Luciano Castro', 'Giulia Bianchi'] },
      { id: 'c5', title: 'Landing page di iscrizione', labels: [{ text: 'Marketing', tone: 'sky' }, { text: 'Design', tone: 'pine' }], assignees: ['Marco Neri'] }
    ] },
    { id: 'review', title: 'In revisione', cards: [
      { id: 'c6', title: 'Email di benvenuto (sequenza 3 invii)', labels: [{ text: 'Marketing', tone: 'sky' }], checklist: { done: 3, total: 3 }, comments: 1, assignees: ['Giulia Bianchi'] }
    ] },
    { id: 'done', title: 'Fatto', cards: [
      { id: 'c7', title: 'Scelta del titolo del corso', labels: [{ text: 'Strategia', tone: 'plum' }], checklist: { done: 2, total: 2 } },
      { id: 'c8', title: 'Apertura della cartella di progetto' }
    ] }
  ];
  /* perché una scheda non entra nella lista: i passaggi della lista da cui parte, il limite che blocca, i requisiti del modulo; in quest'ordine (richieste 225-227). null: entra */
  function kanbanRefusal(T, lists, card, from, to, canEnter) {
    if (!card || !from || !to || from.id === to.id) return null; /* dentro la stessa lista si riordina sempre */
    if (from.transitions) {
      if (from.transitions.indexOf(to.id) < 0) {
        var ns = from.transitions.map(function (id) { var l = lists.filter(function (x) { return x.id === id; })[0]; return l ? '“' + l.title + '”' : null; }).filter(Boolean);
        return textOf(textOf(T.onlyTo, '{from}', from.title), '{lists}', ns.length ? ns.join(', ') : T.nowhere);
      }
    }
    if (to.blocks && to.limit != null && (to.cards || []).length + 1 > to.limit) return textOf(textOf(to.limit == 1 ? T.atLimitOne : T.atLimit, '{list}', to.title), '{n}', String(to.limit));
    if (canEnter) { var r; try { r = canEnter(card, to, from); } catch (e) { r = null; } if (typeof r === 'string' && r) return r; }
    return null;
  }
  function kanbanWhere(ls, id) { for (var i = 0; i < ls.length; i++) for (var k = 0; k < ls[i].cards.length; k++) if (ls[i].cards[k].id === id) return { list: ls[i], index: k, card: ls[i].cards[k] }; return null; }
  function kanbanPut(ls, id, toList, at) { /* toglie la scheda e la mette in toList: prima della scheda at (un id), al posto at (un numero), o in fondo */
    var card = null;
    var n = ls.map(function (l) { return Object.assign({}, l, { cards: l.cards.filter(function (c) { if (c.id === id) { card = c; return false; } return true; }) }); });
    if (!card) return ls;
    return n.map(function (l) {
      if (l.id !== toList) return l;
      var cards = l.cards.slice(), i = typeof at === 'number' ? Math.min(at, cards.length) : at ? cards.findIndex(function (c) { return c.id === at; }) : -1;
      if (i < 0) cards.push(card); else cards.splice(i, 0, card);
      return Object.assign({}, l, { cards: cards });
    });
  }
  function kanbanCopy(ls) { return ls.map(function (l) { return Object.assign({}, l, { cards: (l.cards || []).map(function (c) { return Object.assign({}, c); }) }); }); } /* copia che tiene le funzioni delle actions (non JSON) */
  /* scorrimento al bordo: fascia del 20% per lato, fino a 600 px/s, al più 0,25 s per fotogramma (richiesta 231) */
  var EDGE_BAND = 0.2;
  var EDGE_SPEED = 600;
  var EDGE_STEP = 0.25;
  function KanbanBoard(p) {
    var C = useLabels(), T = kanbanTexts(p.texts);
    if (!p.texts || p.texts.add == null) T.add = C.add; /* «Aggiungi» e «Annulla» del riquadro di scrittura nella lingua dell'app, se il modulo non li passa (richiesta 186) */
    if (!p.texts || p.texts.cancel == null) T.cancel = C.cancel;
    var votes = {}; (p.lists || []).forEach(function (l) { (l.cards || []).forEach(function (c) { if (c.votes) votes[c.id] = c.votes; }); }); /* i voti seguono le liste che il modulo ripassa (richiesta 170) */
    var st = useState(function () { return kanbanCopy(p.lists || SAMPLE_LISTS); });
    var lists = st[0], cur = useRef(lists); cur.current = lists;
    var ov = useState(null), overId = ov[0], setOverId = ov[1];
    var dg = useState(null), dragId = dg[0], setDragId = dg[1];
    var rf = useState(null), refused = rf[0], setRefused = rf[1], refusedRef = useRef(null); /* { list, reason }: la lista sotto la scheda che non la prende */
    var ad = useState(null), addingIn = ad[0], setAddingIn = ad[1];
    var tx = useState(''), draft = tx[0], setDraft = tx[1];
    var vw = useState('board'), view = vw[0], setView = vw[1];
    var ed = useState(null), editingId = ed[0], setEditingId = ed[1];
    var jm = useState(false), jumpOpen = jm[0], jumpBtn = useRef(null);
    var lv = useState(''), said = lv[0], setSaid = lv[1], told = useRef({ text: '', at: 0 });
    var pd = useState({}), busy = pd[0], setBusy = pd[1], pend = useRef({});
    var ld = useState(null), lift = ld[0], setLift = ld[1], liftRef = useRef(null); /* la lista presa: { i, to, dx, rows, pid | kb } */
    var lanes = useRef(null), edge = useRef(null), refocus = useRef(null), lastJ = useRef(null), live = useRef(true), seq = useRef(100);
    var pl = useState(null), busyList = pl[0], pendList = useRef(null); /* la lista spostata che aspetta il modulo: { id, to } */
    var dragRef = useRef(null), held = useRef(false), moved = useRef(false), lost = useRef(false); /* la scheda trascinata resta dov'è finché il trascinamento non finisce, anche se il modulo la sposta */
    var keysId = useId('zr-listkeys');
    useEffect(function () { live.current = true; return function () { live.current = false; if (edge.current) cancelAnimationFrame(edge.current.raf); }; }, []);

    function set(n) { cur.current = n; st[1](n); }
    function withVotes(c) { return p.lists ? Object.assign({}, c, { votes: votes[c.id] }) : c; } /* con le liste del modulo i voti sono i suoi di adesso, non quelli della copia */
    function commit(next) { set(next); if (p.onChange) p.onChange(p.lists ? next.map(function (l) { return Object.assign({}, l, { cards: l.cards.map(withVotes) }); }) : next); }
    function say(x) { setSaid(function (v) { return v === x ? x + '\u00a0' : x; }); } /* lo stesso testo detto due volte si sente due volte */
    function titleOf(id) { var l = cur.current.filter(function (x) { return x.id === id; })[0]; return l ? l.title : ''; }

    /* liste controllate: con onMove o onMoveList, quando il modulo passa liste diverse (la risposta del server) la board le prende;
       gli spostamenti che aspettano il modulo restano dove vanno, e la scheda trascinata resta dov'è fino al rilascio (richiesta 230).
       Senza, la board copia le liste una volta, come prima */
    var controlled = !!(p.lists && (p.onMove || p.onMoveList));
    function synced(src) {
      var n = kanbanCopy(src);
      Object.keys(pend.current).forEach(function (id) { var w = kanbanWhere(n, id), q = pend.current[id]; if (w && w.list.id !== q.to) n = kanbanPut(n, id, q.to, q.at); });
      var d = dragRef.current, w0 = d && kanbanWhere(cur.current, d), w1 = d && kanbanWhere(n, d);
      if (w0 && (!w1 || w1.list.id !== w0.list.id) && !n.some(function (l) { return l.id === w0.list.id; })) lost.current = true; /* la lista da cui parte non c'è più: la scheda va dove la mette il modulo, e il trascinamento finisce */
      else if (w0 && (!w1 || w1.list.id !== w0.list.id)) {
        held.current = true;
        if (w1) n = kanbanPut(n, d, w0.list.id, w0.index);
        else n = n.map(function (l) { if (l.id !== w0.list.id) return l; var cs = l.cards.slice(); cs.splice(Math.min(w0.index, cs.length), 0, w0.card); return Object.assign({}, l, { cards: cs }); });
      }
      var q = pendList.current, i = q ? n.map(function (l) { return l.id; }).indexOf(q.id) : -1;
      if (i >= 0 && i !== q.to) { var m = n.slice(), x = m.splice(i, 1)[0]; m.splice(Math.min(q.to, m.length), 0, x); n = m; }
      return n;
    }
    useEffect(function () {
      if (!controlled) return;
      var j = JSON.stringify(p.lists);
      if (lastJ.current === null) { lastJ.current = j; return; }
      if (j === lastJ.current) return;
      lastJ.current = j;
      set(synced(p.lists));
      if (lost.current) { lost.current = false; dragRef.current = null; held.current = false; moved.current = false; refusedRef.current = null; setRefused(null); setDragId(null); setOverId(null); edgeStop(); } /* la scheda si rismonta: dragend non arriverebbe */
    }, [p.lists, controlled]);
    function release() { /* fine del trascinamento di una scheda: se il modulo l'aveva spostata e il rilascio non l'ha mossa, vale la sua lista */
      var h0 = held.current, m0 = moved.current; dragRef.current = null; held.current = false; moved.current = false;
      if (h0 && !m0 && controlled && live.current) set(synced(p.lists));
    }
    function colOf(id) { var cs = cols(); for (var i = 0; i < cs.length; i++) if (cs[i].getAttribute('data-list-id') === String(id)) return cs[i]; return null; }
    /* il fuoco dopo uno spostamento della lista (dal menu o dalla tastiera): torna al suo pulsante, anche se la lista ha cambiato posto */
    useEffect(function () {
      var r = refocus.current; if (!r || !lanes.current) return; refocus.current = null;
      var col = colOf(r.id), t = col && col.querySelector(r.what === 'menu' ? '.zr-col-menu' : '.zr-col-handle');
      if (t && document.activeElement !== t) t.focus();
    });

    /* spostare una scheda. onMove può fermarlo: false lo ferma prima, una Promise rifiutata o risolta a false la riporta dov'era (richiesta 230, come DealPipeline) */
    function move(cardId, toList, at) {
      var ls = cur.current, w = kanbanWhere(ls, cardId), to = ls.filter(function (l) { return l.id === toList; })[0];
      if (!w || !to || pend.current[cardId] || at === cardId) return;
      var why = kanbanRefusal(T, ls, w.card, w.list, to, p.canEnter); if (why) return;
      var n = kanbanPut(ls, cardId, toList, at), now = kanbanWhere(n, cardId);
      if (now.list.id === w.list.id && now.index === w.index) return; /* lasciata dov'era */
      var r; if (p.onMove) { try { r = p.onMove(withVotes(w.card), toList, w.list.id, typeof at === 'string' ? at : null); } catch (e) { r = false; } }
      if (r === false) { say(textOf(textOf(T.cardBack, '{card}', w.card.title), '{list}', w.list.title)); return; }
      if (cardId === dragRef.current) moved.current = true;
      commit(n);
      if (!r || typeof r.then !== 'function') return;
      pend.current[cardId] = { to: toList, at: now.index }; setBusy(Object.assign({}, pend.current));
      function end(ok) {
        if (!live.current) return;
        delete pend.current[cardId]; setBusy(Object.assign({}, pend.current));
        if (ok !== false || !kanbanWhere(cur.current, cardId)) return;
        commit(kanbanPut(cur.current, cardId, w.list.id, w.index));
        say(textOf(textOf(T.cardBack, '{card}', w.card.title), '{list}', w.list.title));
      }
      r.then(end, function () { end(false); });
    }
    function addCard(listId) {
      var t = draft.trim();
      if (!t) { setAddingIn(null); return; }
      var to = cur.current.filter(function (l) { return l.id === listId; })[0];
      if (to && to.blocks && to.limit != null && to.cards.length + 1 > to.limit) { say(textOf(T.refusedSay, '{reason}', textOf(textOf(to.limit == 1 ? T.atLimitOne : T.atLimit, '{list}', to.title), '{n}', String(to.limit)))); return; } /* piena col limite che blocca: il testo resta (richiesta 227) */
      seq.current += 1;
      commit(cur.current.map(function (l) { return l.id === listId ? Object.assign({}, l, { cards: l.cards.concat([{ id: 'n' + seq.current, title: t }]) }) : l; }));
      setDraft('');
    }
    function addList() {
      seq.current += 1;
      commit(cur.current.concat([{ id: 'l' + seq.current, title: T.newList, cards: [] }]));
    }

    /* spostare una lista: dalla maniglia (puntatore o tastiera) o dal menu. onMoveList può fermarlo come onMove (richieste 224 e 230) */
    function placeSay(k, l, n) { return textOf(textOf(textOf(T[k], '{title}', l.title), '{n}', String(n + 1)), '{total}', String(cur.current.length)); }
    function moveList(from, to, how) {
      var ls = cur.current, l = ls[from];
      if (pendList.current) return; /* un altro spostamento di lista aspetta il modulo */
      if (!l || from === to || to < 0 || to >= ls.length) { if (l && (how === 'keys' || how === 'pointer')) say(placeSay('listDropped', l, from)); return; } /* lasciata dov'era */
      var r; if (p.onMoveList) { try { r = p.onMoveList(l, to, from); } catch (e) { r = false; } }
      if (how) refocus.current = { id: l.id, what: how === 'menu' ? 'menu' : 'handle' };
      if (r === false) { say(placeSay('listBack', l, from)); return; }
      var n = ls.slice(); n.splice(from, 1); n.splice(to, 0, l); commit(n);
      say(placeSay('listDropped', l, to));
      if (!r || typeof r.then !== 'function') return;
      pendList.current = { id: l.id, to: to }; pl[1](l.id);
      function end(ok) {
        if (!live.current) return;
        pendList.current = null; pl[1](null);
        if (ok !== false) return;
        var c = cur.current, i = c.indexOf(c.filter(function (x) { return x.id === l.id; })[0]); if (i < 0) return;
        var m = c.slice(); m.splice(i, 1); m.splice(Math.min(from, m.length), 0, c[i]); commit(m);
        say(placeSay('listBack', l, from));
      }
      r.then(end, function () { end(false); });
    }

    /* scorrimento al bordo con velocità fissa, non quella del carico della pagina: a ogni fotogramma, solo dopo un movimento verso quel lato (richiesta 231) */
    function edgeStart(x) {
      edgeStop();
      var e = edge.current = { x: x, dir: 0, pos: null, t: 0, raf: 0 };
      function tick(now) {
        var el = lanes.current; if (edge.current !== e || !el) return;
        var r = el.getBoundingClientRect(), band = r.width * EDGE_BAND, v = 0, dt = e.t ? Math.min(EDGE_STEP, (now - e.t) / 1000) : 0; e.t = now;
        if (band > 0 && e.dir < 0 && e.x < r.left + band) v = -EDGE_SPEED * Math.min(1, (r.left + band - e.x) / band);
        if (band > 0 && e.dir > 0 && e.x > r.right - band) v = EDGE_SPEED * Math.min(1, (e.x - (r.right - band)) / band);
        if (band > 0 && (e.x < r.left + band || e.x > r.right - band)) { /* nella fascia lo scorrimento è solo della board: quello del browser, che in Chromium si somma, si annulla a ogni fotogramma */
          if (e.pos == null) e.pos = el.scrollLeft;
          if (v && dt) e.pos = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, e.pos + v * dt));
          if (el.scrollLeft !== e.pos) el.scrollLeft = e.pos;
          if (v && dt && liftRef.current && !liftRef.current.kb) follow(e.x);
        } else e.pos = null;
        e.raf = requestAnimationFrame(tick);
      }
      e.raf = requestAnimationFrame(tick);
    }
    function edgeMove(x) { var e = edge.current; if (!e || x == null) return; if (x < e.x - 1) e.dir = -1; else if (x > e.x + 1) e.dir = 1; e.x = x; }
    function edgeStop() { if (edge.current) cancelAnimationFrame(edge.current.raf); edge.current = null; }
    useEffect(function () { /* la scheda trascinata: la posizione del puntatore la dà dragover */
      if (!dragId) return;
      function over(e) { edgeMove(e.clientX); }
      document.addEventListener('dragover', over, true);
      return function () { document.removeEventListener('dragover', over, true); };
    }, [dragId]);

    /* la lista presa col puntatore: le altre si spostano, lei segue il puntatore anche quando la board scorre */
    function cols() { return lanes.current ? Array.prototype.filter.call(lanes.current.children, function (x) { return x.classList.contains('zr-col'); }) : []; }
    function measure() { var el = lanes.current, b = el.getBoundingClientRect(); return cols().map(function (c) { var r = c.getBoundingClientRect(); return { left: r.left - b.left + el.scrollLeft, w: r.width }; }); }
    function grab(e, i) {
      if (e.button > 0 || cur.current.length < 2 || liftRef.current || pendList.current) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* senza cattura si segue lo stesso */ }
      var el = lanes.current, b = el.getBoundingClientRect();
      liftRef.current = { i: i, to: i, dx: 0, rows: measure(), pid: e.pointerId, x0: e.clientX - b.left + el.scrollLeft };
      setLift(liftRef.current); edgeStart(e.clientX);
      say(textOf(T.listTaken, '{title}', cur.current[i].title));
    }
    function follow(x) {
      var d = liftRef.current, el = lanes.current; if (!d || d.kb || !el) return;
      var dx = x - el.getBoundingClientRect().left + el.scrollLeft - d.x0, r = d.rows[d.i], mid = r.left + r.w / 2 + dx, to = 0;
      d.rows.forEach(function (q, k) { if (k !== d.i && mid > q.left + q.w / 2) to++; });
      if (to !== d.to) say(placeSay('listAt', cur.current[d.i], to));
      liftRef.current = Object.assign({}, d, { dx: dx, to: to }); setLift(liftRef.current);
    }
    function pointerMove(e) { var d = liftRef.current; if (!d || d.kb || e.pointerId !== d.pid) return; edgeMove(e.clientX); follow(e.clientX); }
    function drop() { var d = liftRef.current; if (!d || d.kb) return; liftRef.current = null; setLift(null); edgeStop(); moveList(d.i, d.to, 'pointer'); }
    function cancelLift(said) { var d = liftRef.current; if (!d) return; liftRef.current = null; setLift(null); edgeStop(); if (said) say(textOf(T.listCancelled, '{title}', cur.current[d.i].title)); }
    useEffect(function () { /* Esc mentre si trascina col puntatore lascia tutto com'era */
      if (!lift || lift.kb) return;
      function k(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelLift(true); } }
      document.addEventListener('keydown', k, true); return function () { document.removeEventListener('keydown', k, true); };
    }, [!!lift && !lift.kb]);
    /* dalla tastiera, sulla maniglia: Spazio prende, ← → spostano, Spazio o Invio lasciano, Esc rimette dov'era */
    function handleKey(e, i) {
      var k = e.key, d = liftRef.current;
      if (!d) { if ((k === ' ' || k === 'Spacebar') && cur.current.length > 1) { e.preventDefault(); if (pendList.current) { say(textOf(T.listWait, '{title}', titleOf(pendList.current.id))); return; } liftRef.current = { i: i, to: i, kb: true, rows: measure() }; setLift(liftRef.current); say(textOf(T.listTaken, '{title}', cur.current[i].title)); } return; }
      if (!d.kb) return;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault(); var to = Math.max(0, Math.min(cur.current.length - 1, d.to + (k === 'ArrowRight' ? 1 : -1)));
        if (to !== d.to) { liftRef.current = Object.assign({}, d, { to: to }); setLift(liftRef.current); }
        say(placeSay('listAt', cur.current[d.i], to));
      } else if (k === ' ' || k === 'Spacebar' || k === 'Enter') { e.preventDefault(); liftRef.current = null; setLift(null); moveList(d.i, d.to, 'keys'); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelLift(true); }
      else if (k === 'Tab') cancelLift(true);
    }
    function shiftOf(k) { /* di quanto si sposta la lista k mentre una è presa */
      var d = lift; if (!d) return 0;
      var gap = d.rows.length > 1 ? d.rows[1].left - d.rows[0].left - d.rows[0].w : 0, wi = d.rows[d.i] ? d.rows[d.i].w + gap : 0;
      if (k === d.i) {
        if (!d.kb) return d.dx;
        var s = 0; if (d.to > d.i) for (var a = d.i + 1; a <= d.to; a++) s += d.rows[a].w + gap; else for (var b = d.to; b < d.i; b++) s -= d.rows[b].w + gap; return s;
      }
      return d.i < k && k <= d.to ? -wi : d.to <= k && k < d.i ? wi : 0;
    }
    useEffect(function () { /* la lista presa dalla tastiera resta in vista */
      if (!lift || !lift.kb || !lanes.current) return;
      var c = cols()[lift.i], el = lanes.current; if (!c) return;
      var r = c.getBoundingClientRect(), b = el.getBoundingClientRect();
      if (r.left < b.left) el.scrollLeft -= b.left - r.left + 16; else if (r.right > b.right) el.scrollLeft += r.right - b.right + 16;
    }, [lift && lift.kb ? lift.to : -1]);

    /* trascinare una scheda: la lista che non la prende si vede e si sente (richieste 225-227) */
    function reasonFor(l) { var w = dragId && kanbanWhere(cur.current, dragId); return w ? kanbanRefusal(T, cur.current, w.card, w.list, l, p.canEnter) : null; }
    function sayRefusal(reason) { var t = textOf(T.refusedSay, '{reason}', reason); if (told.current.text !== t) say(t); told.current = { text: t, at: Date.now() }; }
    function endDrag(e, card) {
      var r = refusedRef.current, none = !e || !e.dataTransfer || e.dataTransfer.dropEffect === 'none';
      if (r && none) {
        if (Date.now() - told.current.at < 2000) setTimeout(function () { if (live.current) say(textOf(T.refusedSay, '{reason}', r.reason)); }, 150); /* lasciata subito dopo l'annuncio: la ragione si ridice */
        if (p.onRefuse) { var to = cur.current.filter(function (l) { return l.id === r.list; })[0]; if (to) p.onRefuse(withVotes(card), to, r.reason); }
      }
      refusedRef.current = null; setRefused(null); told.current.text = ''; setDragId(null); setOverId(null); edgeStop(); release();
    }

    function jump(l) { /* «Vai alla lista»: il fuoco sulla scheda corrente della lista scelta, o sul suo «Aggiungi scheda» (richiesta 229) */
      var col = colOf(l.id); if (!col) return;
      var t = col.querySelector('.zr-col-body .zr-card[tabindex="0"]') || col.querySelector('.zr-col-add, .zr-composer textarea') || col.querySelector('.zr-col-menu');
      if (t) { t.focus(); if (t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }

    var views = [['board', T.board, 'board'], ['list', T.list, 'list'], ['calendar', T.calendar, 'calendar']];

    return h('div', { className: 'zr-board' },
      h('header', { className: 'zr-board-head' },
        p.crumbs === false ? null : h('nav', { className: 'zr-crumbs', 'aria-label': T.crumbs },
          h('a', { href: '#' , onClick: function (e) { e.preventDefault(); } }, p.product || 'Board'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('a', { href: '#', onClick: function (e) { e.preventDefault(); } }, p.folder || 'Corsi 2026'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('span', { 'aria-current': 'page' }, p.title || 'Lancio corso Leadership')),
        h('div', { className: 'zr-board-titlebar' },
          h('h1', { className: 'zr-board-title' }, p.title || 'Lancio corso Leadership'),
          h('div', { className: 'zr-board-actions' },
            h(AvatarStack, { people: p.members || ['Luciano Castro', 'Giulia Bianchi', 'Marco Neri', 'Costanza Rossi'], max: 3 }),
            h('button', { ref: jumpBtn, type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-sm', 'aria-haspopup': 'menu', 'aria-expanded': jumpOpen, onClick: function () { jm[1](!jumpOpen); } }, h(Icon, { name: 'list', size: 16 }), h('span', null, T.jumpTo)),
            h(Button, { variant: 'secondary', size: 'sm', icon: 'filter' }, T.filter),
            h(Button, { variant: 'primary', size: 'sm', icon: 'share' }, T.share))),
        h('div', { className: 'zr-tabs', role: 'tablist' },
          views.map(function (v) {
            return h('button', { key: v[0], type: 'button', role: 'tab', 'aria-selected': view === v[0], className: cx('zr-tab', view === v[0] && 'is-active'), onClick: function () { setView(v[0]); } }, h(Icon, { name: v[2], size: 16 }), v[1]);
          }))),
      jumpOpen ? h(Menu, { anchor: jumpBtn.current, align: 'end', label: T.jumpTo, onClose: function () { jm[1](false); }, items: lists.map(function (l) { return { label: l.title, onClick: function () { jump(l); } }; }) }) : null,
      h('span', { className: 'zr-visually-hidden', 'aria-live': 'polite' }, said),
      h('span', { id: keysId, hidden: true }, T.listKeys),
      h('div', { ref: lanes, className: cx('zr-lanes', lift && 'is-moving') },
        lists.map(function (l, i) {
          var composer = addingIn === l.id ? h('div', { className: 'zr-composer' },
            h('textarea', {
              autoFocus: true, rows: 2, value: draft, placeholder: T.cardTitle, 'aria-label': T.cardTitleLabel,
              onChange: function (e) { setDraft(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(l.id); } if (e.key === 'Escape') { setAddingIn(null); setDraft(''); } }
            }),
            h('div', { className: 'zr-composer-row' },
              h(Button, { size: 'sm', onClick: function () { addCard(l.id); } }, T.add),
              h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': p.closeLabel || T.cancel, onClick: function () { setAddingIn(null); setDraft(''); } }))) : null;
          var src = (p.lists || []).filter(function (x) { return x.id === l.id; })[0] || l, wait = busyList === l.id; /* le funzioni di action e actions sono quelle del modulo di adesso, non della copia */
          var acts = (p.onRenameList ? [{ icon: 'edit', label: T.rename, onClick: function () { setEditingId(l.id); } }] : []).concat(src.actions || []);
          if (lists.length > 1) acts = acts.concat(acts.length ? [{ sep: true }] : [], [
            { icon: 'chevronLeft', label: T.moveLeft, disabled: i === 0 || !!busyList, onClick: function () { moveList(i, i - 1, 'menu'); } },
            { icon: 'chevron', label: T.moveRight, disabled: i === lists.length - 1 || !!busyList, onClick: function () { moveList(i, i + 1, 'menu'); } }]);
          var y = shiftOf(i), lifted = lift && lift.i === i;
          var handle = lists.length > 1 ? h('button', { type: 'button', className: 'zr-col-handle', 'aria-disabled': busyList ? true : undefined, 'aria-label': textOf(T.moveList, '{title}', l.title), 'aria-describedby': keysId,
            onPointerDown: function (e) { grab(e, i); }, onPointerMove: pointerMove, onPointerUp: drop, onPointerCancel: function () { cancelLift(false); },
            onKeyDown: function (e) { handleKey(e, i); }, onBlur: function () { if (liftRef.current && liftRef.current.kb) cancelLift(true); } }, h(Icon, { name: 'menu', size: 16 })) : null;
          return h(KanbanColumn, {
            key: l.id, 'data-list-id': l.id, title: l.title, count: l.cards.length, limit: l.limit, blocks: l.blocks, kind: l.kind, threshold: l.threshold, rules: l.rules, action: src.action, texts: p.texts, 'aria-busy': wait || undefined,
            isOver: overId === l.id && dragId != null, refused: refused && refused.list === l.id ? refused.reason : null,
            className: lifted ? 'is-lifted' : undefined, style: y ? { transform: 'translateX(' + y + 'px)' } : undefined,
            handle: handle, actions: acts,
            editing: editingId === l.id, onEditingChange: function (v) { if (!v) { setEditingId(null); refocus.current = { id: l.id, what: 'menu' }; } },
            onRename: p.onRenameList ? function (v) {
              var r = p.onRenameList(l, v);
              function apply() { if (!live.current) return; commit(cur.current.map(function (x) { return x.id === l.id ? Object.assign({}, x, { title: v }) : x; })); }
              if (r && typeof r.then === 'function') return r.then(function (x) { apply(); return x; });
              apply();
            } : undefined,
            composer: composer, onAdd: function () { setAddingIn(l.id); setDraft(''); },
            onDragOver: function (e) {
              if (!dragId) return;
              var why = reasonFor(l);
              if (why) { /* niente preventDefault: qui la scheda non si lascia */
                if (!refusedRef.current || refusedRef.current.list !== l.id) { refusedRef.current = { list: l.id, reason: why }; setRefused(refusedRef.current); sayRefusal(why); }
                if (overId !== null) setOverId(null); return;
              }
              e.preventDefault(); if (refusedRef.current) { refusedRef.current = null; setRefused(null); told.current.text = ''; }
              if (overId !== l.id) setOverId(l.id);
            },
            onDragLeave: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) { setOverId(null); if (refusedRef.current && refusedRef.current.list === l.id && e.relatedTarget) { refusedRef.current = null; setRefused(null); } } },
            onDrop: function (e) { e.preventDefault(); if (dragId) move(dragId, l.id, null); setOverId(null); setDragId(null); edgeStop(); release(); }
          }, l.cards.map(function (c) {
            var wait = !!busy[c.id];
            return h(KanbanCard, Object.assign({ key: c.id, texts: p.texts }, c, {
              votes: p.lists ? votes[c.id] : c.votes, draggable: !wait, dragging: dragId === c.id, 'aria-busy': wait || undefined,
              onDragStart: function (e) { setDragId(c.id); dragRef.current = c.id; held.current = false; moved.current = false; told.current = { text: '', at: 0 }; edgeStart(e.clientX); try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} },
              onDragEnd: function (e) { endDrag(e, c); },
              onDrop: function (e) { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== c.id) move(dragId, l.id, c.id); setOverId(null); setDragId(null); edgeStop(); release(); },
              onClick: p.onOpenCard ? function () { p.onOpenCard(withVotes(c)); } : undefined
            }));
          }));
        }),
        h(AddList, { label: T.addList, onClick: addList })));
  }

export { KanbanBoard };
