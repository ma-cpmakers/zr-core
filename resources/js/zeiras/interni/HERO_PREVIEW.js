// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 2 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './h';
import { KanbanCard } from '../KanbanCard';

  var HERO_PREVIEW = { title: 'Lancio corso · Board', lanes: [
    { title: 'Da fare', cards: [{ title: 'Definire gli obiettivi', labels: [{ text: 'Strategia', tone: 'plum' }], due: '3 ott', assignees: ['Luciano Castro'] }, { title: 'Raccogliere testimonianze', labels: [{ text: 'Marketing', tone: 'sky' }], comments: 2 }] },
    { title: 'In corso', cards: [{ title: 'Scaletta del modulo 2', cover: 'citrus', labels: [{ text: 'Contenuti', tone: 'citrus' }], checklist: { done: 3, total: 5 }, assignees: ['Giulia Bianchi', 'Marco Neri'] }] },
    { title: 'Fatto', cards: [{ title: 'Titolo del corso', checklist: { done: 2, total: 2 } }] }
  ] };
  function HeroPreview(p) {
    var pv = p.preview || HERO_PREVIEW;
    return h('div', { className: 'zr-hero-shot', 'aria-hidden': true },
      h('div', { className: 'zr-hero-shot-bar' }, h('i'), h('i'), h('i'), h('span', null, pv.title)),
      h('div', { className: 'zr-hero-shot-lanes' },
        (pv.lanes || []).map(function (ln, i) {
          return h('div', { key: i, className: 'zr-hero-lane' }, h('div', { className: 'zr-hero-lane-t' }, ln.title),
            (ln.cards || []).map(function (c, j) { return h(KanbanCard, Object.assign({ key: j, tabIndex: -1 }, c)); }));
        })));
  }

export { HeroPreview };
