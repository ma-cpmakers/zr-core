// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DealPipeline di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';
import { textOf } from './interni/kanbanTexts';
import { KanbanColumn } from './KanbanColumn';
import { fmtMoney } from './interni/MONEY';
import { PageHeader } from './PageHeader';
import { DealCard } from './DealCard';
import { Menu } from './Menu';

  var SAMPLE_STAGES = [
    { id: 'new', title: 'Nuovo lead', deals: [{ id: 'd1', title: 'Corso Leadership · 12 posti', company: 'Rossi Logistica', amount: 7200, owner: 'Luciano Castro', probability: 10, age: 2 }, { id: 'd2', title: 'Formazione PM interna', company: 'Studio Bianchi', amount: 3400, owner: 'Giulia Bianchi', probability: 10, age: 5 }] },
    { id: 'qual', title: 'Qualificato', deals: [{ id: 'd3', title: 'Certificazione PMP ×4', company: 'Nexa Srl', amount: 9800, owner: 'Marco Neri', probability: 30, age: 9 }] },
    { id: 'prop', title: 'Proposta', deals: [{ id: 'd4', title: 'Percorso manager 2027', company: 'Alfa Costruzioni', amount: 18500, owner: 'Luciano Castro', probability: 55, age: 18 }, { id: 'd5', title: 'Coaching team vendite', company: 'Verdi & Figli', amount: 4200, owner: 'Giulia Bianchi', probability: 50, age: 4 }] },
    { id: 'neg', title: 'Negoziazione', deals: [{ id: 'd6', title: 'Academy aziendale', company: 'Orion Spa', amount: 26000, owner: 'Marco Neri', probability: 75, age: 7 }] },
    { id: 'won', title: 'Vinto', deals: [{ id: 'd7', title: 'Workshop Agile', company: 'Blu Digital', amount: 2900, owner: 'Luciano Castro', probability: 100, age: 1 }] }
  ];
  /* sposta una trattativa nella fase `to`, alla posizione `at` (in fondo se -1); numero e totali passati dal modulo seguono lo spostamento (richiesta 1) */
  function dealMove(list, id, to, at, put) {
    var deal = null, from = null;
    if (!list.some(function (s) { return s.id === to; })) return list;
    var n = list.map(function (s) { var ds = s.deals.filter(function (d) { if (d.id === id) { deal = d; from = s.id; return false; } return true; }); return ds.length === s.deals.length ? s : Object.assign({}, s, { deals: ds }); });
    if (!deal || from === to) return list;
    var x = put || deal, a = x.amount || 0, w = a * (x.probability || 0) / 100;
    function shift(s, k) { var o = Object.assign({}, s); if (o.count != null) o.count += k; if (o.total != null) o.total += k * a; if (o.weighted != null) o.weighted += k * w; return o; }
    return n.map(function (s) {
      if (s.id === from) return shift(s, -1);
      if (s.id !== to) return s;
      var o = shift(s, 1), ds = s.deals.slice(); if (at >= 0 && at < ds.length) ds.splice(at, 0, x); else ds.push(x); o.deals = ds; return o;
    });
  }
  function dealStageOf(list, id) { var r = null; list.forEach(function (s) { s.deals.forEach(function (d, i) { if (d.id === id) r = { stage: s.id, index: i, deal: d }; }); }); return r; }
  function DealPipeline(p) {
    var st = useState(function () { return JSON.parse(JSON.stringify(p.stages || SAMPLE_STAGES)); }), stages = st[0], setStages = st[1];
    var cur = useRef(stages); cur.current = stages;
    var dg = useState(null), drag = dg[0], setDrag = dg[1];
    var ov = useState(null), over = ov[0], setOver = ov[1];
    var pd = useState({}), busy = pd[0], setBusy = pd[1], pend = useRef({});
    var lv = useState(''), said = lv[0], setSaid = lv[1];
    var pm = useState(false), plMenu = pm[0], plBtn = useRef(null);
    var root = useRef(null), refocus = useRef(null), lastStages = useRef(null), live = useRef(true);
    var adj = useRef({ open: 0, weighted: 0 }), lastTotals = useRef(undefined);
    var L = Object.assign({ overline: 'CRM', title: 'Pipeline vendite', open: 'Aperte', weighted: 'Ponderate', filter: 'Filtra', newDeal: 'Nuova trattativa', total: 'Totale', stageWeighted: 'Ponderato', more: 'Mostra altre', seeAll: 'Vedi tutte', openDeal: 'Apri', moveTo: 'Sposta in {stage}', moved: '{deal} spostata in {stage}', back: '{deal} resta in {stage}', dealActions: 'Azioni rapide', pipeline: 'Pipeline' }, p.labels || {});
    React.useEffect(function () { live.current = true; return function () { live.current = false; }; }, []);
    function kindOf(s) { return s.kind || (s.id === 'won' ? 'won' : s.id === 'lost' ? 'lost' : 'open'); }
    function set(n) { cur.current = n; setStages(n); }
    /* lo stesso testo detto due volte si sente due volte */
    function say(x) { setSaid(function (v) { return v === x ? x + '\u00a0' : x; }); }
    /* quanto cambiano aperte e ponderate della testa se la trattativa passa da una fase all'altra */
    function delta(list, deal, from, to) {
      var k = {}; list.forEach(function (s) { k[s.id] = kindOf(s); });
      var g = (k[to] === 'open' ? 1 : 0) - (k[from] === 'open' ? 1 : 0), a = deal.amount || 0;
      return { open: g * a, weighted: g * a * (deal.probability || 0) / 100 };
    }
    function bump(d, k) { adj.current = { open: adj.current.open + k * d.open, weighted: adj.current.weighted + k * d.weighted }; }
    function keep() { var a = document.activeElement; if (!a || !root.current || !root.current.contains(a)) return null; var m = a.getAttribute('data-more'); return { el: a, id: a.getAttribute('data-deal-id'), more: m, n: m ? (cur.current.filter(function (s) { return s.id === m; })[0] || { deals: [] }).deals.length : 0 }; }
    /* stages controllata: il modulo la rinnova (anche ogni 20 s); gli spostamenti che aspettano il modulo restano dove sono, e il fuoco resta dov'era (richiesta 1) */
    React.useEffect(function () {
      if (!p.stages) return;
      var j = JSON.stringify(p.stages);
      if (lastStages.current === null) { lastStages.current = j; return; }
      if (j === lastStages.current) return;
      lastStages.current = j;
      var n = JSON.parse(j);
      Object.keys(pend.current).forEach(function (id) { var w = dealStageOf(n, id), to = pend.current[id].to; if (w && w.stage !== to) n = dealMove(n, id, to, -1, Object.assign({}, w.deal, { age: 0 })); });
      /* il fuoco chiesto da uno spostamento (il modulo che rimanda onChange come stages) vale per le fasi nuove; altrimenti si tiene dov'è */
      var k = keep(); if (k) refocus.current = k; if (refocus.current) refocus.current.for = n; set(n);
    }, [p.stages]);
    /* i totali della testa dal modulo: le correzioni degli spostamenti valgono finché non arrivano totali nuovi; da lì restano solo quelle degli spostamenti che aspettano ancora il modulo */
    var tj = JSON.stringify(p.totals || null);
    if (lastTotals.current !== tj) { if (lastTotals.current !== undefined) { adj.current = { open: 0, weighted: 0 }; Object.keys(pend.current).forEach(function (id) { bump(pend.current[id].d, 1); }); } lastTotals.current = tj; }
    React.useEffect(function () {
      var r = refocus.current; if (!r || !root.current || r.for && r.for !== stages) return; refocus.current = null; /* aspetta il disegno con le fasi per cui è stato chiesto */
      var a = document.activeElement; if (a && a !== document.body && document.contains(a)) return;
      if (r.el && document.contains(r.el)) { r.el.focus(); return; }
      var cards = Array.prototype.slice.call(root.current.querySelectorAll('[data-deal-id]'));
      if (r.id) { cards.forEach(function (el) { if (el.getAttribute('data-deal-id') === r.id) el.focus(); }); return; }
      /* «Mostra altre» sparito con l'ultima pagina: il fuoco va alla prima scheda arrivata, o all'ultima della fase */
      if (r.more) { var col = root.current.querySelector('[data-stage="' + r.more.replace(/["\\]/g, '') + '"]'), cs = col ? col.querySelectorAll('[data-deal-id]') : []; var t = cs[r.n] || cs[cs.length - 1]; if (t) t.focus(); }
    });
    var cy = p.currency || 'EUR';
    function money(v, round) { if (p.formatAmount) try { return p.formatAmount(v); } catch (e) {} return fmtMoney(round ? Math.round(v) : v, cy); } /* totali e ponderati scritti dal modulo, nella sua valuta e lingua (richiesta 190); se la sua funzione sbaglia, come prima */
    function stageTitle(id) { var s = cur.current.filter(function (x) { return x.id === id; })[0]; return s ? s.title : ''; }
    function told(k, deal, id) { return textOf(textOf(L[k], '{deal}', deal.title), '{stage}', stageTitle(id)); }
    /* spostare: trascinando, o con «Sposta in…» dal «⋯». onMove può fermarlo: false lo ferma prima, una Promise rifiutata o risolta a false riporta la scheda dov'era */
    function move(id, to, keys) {
      var w = dealStageOf(cur.current, id);
      if (!w || w.stage === to || pend.current[id] || !cur.current.some(function (s) { return s.id === to; })) return;
      var r; if (p.onMove) { try { r = p.onMove(w.deal, to, w.stage); } catch (e) { r = false; } }
      if (r === false) { if (keys) say(told('back', w.deal, w.stage)); return; }
      var d = delta(cur.current, w.deal, w.stage, to);
      var n = dealMove(cur.current, id, to, -1, Object.assign({}, w.deal, { age: 0 }));
      if (keys) refocus.current = { id: id, for: n };
      bump(d, 1); set(n); if (p.onChange) p.onChange(n);
      if (keys) say(told('moved', w.deal, to));
      if (!r || typeof r.then !== 'function') return;
      pend.current[id] = { to: to, d: d }; setBusy(Object.assign({}, pend.current));
      function end(ok) {
        if (!live.current) return; /* smontata nel frattempo (un'altra pipeline): niente più onChange */
        delete pend.current[id]; setBusy(Object.assign({}, pend.current));
        if (ok !== false) return;
        var now = dealStageOf(cur.current, id); if (!now) return;
        var a = document.activeElement, mine = !a || a === document.body || a.getAttribute('data-deal-id') === id;
        var m = dealMove(cur.current, id, w.stage, w.index, Object.assign({}, now.deal, { age: w.deal.age }));
        if (m === cur.current) return;
        if (mine) refocus.current = { id: id, for: m };
        bump(delta(cur.current, now.deal, now.stage, w.stage), 1); set(m); if (p.onChange) p.onChange(m);
        if (mine || keys) say(told('back', w.deal, w.stage));
      }
      r.then(end, function () { end(false); });
    }
    /* un numero che non si conosce non si mostra: con una parte delle trattative (hasMore, count) la somma di quelle caricate sarebbe sbagliata */
    function partial(s) { return s.hasMore || s.count != null && s.count !== s.deals.length; }
    function sumOf(s) { return s.total != null ? s.total : partial(s) ? null : s.deals.reduce(function (b, d) { return b + (d.amount || 0); }, 0); }
    function weightOf(s) { return s.weighted != null ? s.weighted : partial(s) ? null : s.deals.reduce(function (b, d) { return b + (d.amount || 0) * (d.probability || 0) / 100; }, 0); }
    function add(a, b) { return a == null || b == null ? null : a + b; }
    var openStages = stages.filter(function (s) { return kindOf(s) === 'open'; });
    var T = p.totals || {};
    var total = T.open != null ? T.open + adj.current.open : openStages.reduce(function (a, s) { return add(a, sumOf(s)); }, 0);
    var weighted = T.weighted != null ? T.weighted + adj.current.weighted : openStages.reduce(function (a, s) { return add(a, weightOf(s)); }, 0);
    var sub = [total != null ? L.open + ' ' + money(total) : null, weighted != null ? L.weighted + ' ' + money(weighted, true) : null].filter(Boolean).join(' · ');
    /* più pipeline (piano Team): il menu accanto alle azioni, solo se ce n'è più d'una */
    var pls = p.pipelines || [], pl = pls.filter(function (x) { return x.id === p.pipelineId; })[0] || pls[0];
    var plPick = pls.length > 1 ? h('button', { key: 'p', ref: plBtn, type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-sm zr-deal-pipeline', 'aria-haspopup': 'menu', 'aria-expanded': plMenu, 'aria-label': L.pipeline + ': ' + pl.name, onClick: function () { pm[1](!plMenu); } },
      h('span', null, pl.name), h(Icon, { name: 'chevronDown', size: 16 })) : null;
    var actions = [plPick, h(Button, { key: 'f', variant: 'secondary', size: 'sm', icon: 'filter', onClick: p.onFilter }, L.filter), h(Button, { key: 'n', size: 'sm', icon: 'plus', onClick: p.onNew }, L.newDeal)];
    return h('div', { ref: root, className: 'zr-board' },
      h('div', { className: 'zr-board-head zr-board-head-plain' },
        h(PageHeader, { overline: L.overline, title: p.title || L.title, subtitle: sub || undefined, actions: actions })),
      plMenu && plPick ? h(Menu, { anchor: plBtn.current, align: 'end', label: L.pipeline, onClose: function () { pm[1](false); },
        items: pls.map(function (x) { return { label: x.name, checked: x.id === pl.id, onClick: function () { if (x.id !== pl.id && p.onPipeline) p.onPipeline(x.id); } }; }) }) : null,
      h('span', { className: 'zr-visually-hidden', 'aria-live': 'polite' }, said),
      h('div', { className: 'zr-lanes' }, stages.map(function (s) {
        var k = kindOf(s), sum = sumOf(s), wsum = weightOf(s);
        var more = s.hasMore && p.onMore ? h(Button, { key: 'more', variant: 'ghost', size: 'sm', className: 'zr-col-more', 'data-more': s.id, busy: !!s.loadingMore, onClick: function () { p.onMore(s.id); } }, L.more) : null;
        return h(KanbanColumn, { key: s.id, 'data-stage': s.id, title: s.title, count: s.count != null ? s.count : s.hasMore ? s.deals.length + '+' : s.deals.length, isOver: over === s.id && drag, className: k === 'won' ? 'is-won' : undefined,
          onDragOver: function (e) { e.preventDefault(); if (over !== s.id) setOver(s.id); },
          onDrop: function (e) { e.preventDefault(); if (drag) move(drag, s.id); setDrag(null); setOver(null); },
          composer: h('div', { className: 'zr-col-sums' },
            sum != null ? h('div', { className: 'zr-col-sum' }, h('span', null, L.total), h('strong', null, money(sum))) : null,
            k === 'open' && wsum != null ? h('div', { className: cx('zr-col-sum', sum != null && 'is-sub') }, h('span', null, L.stageWeighted), h('strong', null, money(wsum, true))) : null,
            k !== 'open' && p.onSeeAll ? h(Button, { variant: 'ghost', size: 'sm', className: 'zr-col-see', onClick: function () { p.onSeeAll(s.id); } }, L.seeAll) : null) },
          s.deals.map(function (d) {
            var acts = (p.onOpen ? [{ label: L.openDeal, onClick: function () { p.onOpen(d); } }, { sep: true }] : []).concat(stages.filter(function (x) { return x.id !== s.id; }).map(function (x) { return { label: textOf(L.moveTo, '{stage}', x.title), onClick: function () { move(d.id, x.id, true); } }; }));
            var extra = p.dealActions ? p.dealActions(d) || [] : [];
            if (extra.length) acts = acts.concat([{ sep: true }], extra);
            /* la scheda non è un role="button": dentro c'è il «⋯», che deve restare raggiungibile; «Apri» sta anche nel menu */
            return h(DealCard, Object.assign({ key: d.id, companyIcon: p.companyIcon, currency: cy, formatAmount: p.formatAmount, ageLabel: p.labels && p.labels.days, ageTitle: p.labels && p.labels.daysTitle }, d, { 'data-deal-id': d.id, busy: !!busy[d.id], actions: acts, actionsLabel: L.dealActions + ': ' + d.title,
              draggable: true, dragging: drag === d.id, onDragStart: function (e) { setDrag(d.id); try { e.dataTransfer.setData('text/plain', d.id); } catch (x) {} }, onDragEnd: function () { setDrag(null); setOver(null); },
              onClick: p.onOpen ? function () { p.onOpen(d); } : undefined,
              onKeyDown: p.onOpen ? function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onOpen(d); } } : undefined })); }).concat(more ? [more] : []));
      })));
  }

export { DealPipeline };
