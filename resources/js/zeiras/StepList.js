// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È StepList di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';

  function StepList(p) {
    var steps = p.steps || [
      { title: 'Iscriviti', text: 'Email o Google, nessuna carta. Il tuo spazio di lavoro è pronto subito.', icon: 'users' },
      { title: 'Crea un\'area', text: 'Una per progetto o ambito: lavoro, clienti, casa, studio.', icon: 'folder' },
      { title: 'Organizza la board', text: 'Liste, schede, scadenze e persone. Trascina e il lavoro avanza.', icon: 'board' }
    ];
    return h('ol', { className: 'zr-steps' }, steps.map(function (s, i) {
      return h('li', { key: i, className: 'zr-step' },
        h('span', { className: 'zr-step-n' }, String(i + 1)),
        h('h3', null, s.title),
        h('p', null, s.text));
    }));
  }

export { StepList };
