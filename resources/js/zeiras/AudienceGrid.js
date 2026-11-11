// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AudienceGrid di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function AudienceGrid(p) {
    var items = p.items || [
      { title: 'Progetti personali', text: 'Casa, viaggi, studio: gratis e senza limiti.' },
      { title: 'Freelance', text: 'Clienti, consegne e scadenze sotto controllo.' },
      { title: 'Formazione', text: 'Corsi, docenti e calendari di lancio.' },
      { title: 'Agenzie', text: 'Una board per cliente, tutte in un\'area.' },
      { title: 'Associazioni', text: 'Volontari ed eventi coordinati senza fatica.' },
      { title: 'Studi professionali', text: 'Pratiche e adempimenti visibili a tutto lo studio.' }
    ];
    return h('ul', { className: 'zr-audience' }, items.map(function (a, i) {
      return h('li', { key: i }, h('h3', null, a.title), h('p', null, a.text));
    }));
  }

export { AudienceGrid };
