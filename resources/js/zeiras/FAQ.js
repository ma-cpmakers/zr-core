// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È FAQ di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Icon } from './Icon';

  function FAQ(p) {
    var items = p.items || [
      { q: 'Qual è il trucco?', a: 'Nessuno. Per i progetti personali Zeiras è gratis per sempre, senza limiti di board, liste o schede.' },
      { q: 'Serve una carta di credito per iscriversi?', a: 'No. Basta un indirizzo email o un account Google.' },
      { q: 'Quali prodotti sono disponibili oggi?', a: 'Board, con board Kanban e Gantt. CRM, Report, Automazioni e Contenuti AI sono in arrivo e si attiveranno nello stesso spazio di lavoro.' },
      { q: 'Posso invitare altre persone?', a: 'Sì, puoi condividere una board con chi vuoi e assegnare le schede ai membri.' },
      { q: 'Posso usarlo per la mia azienda?', a: 'Zeiras nasce per essere adattato a settori diversi. Scrivici per conoscere le versioni dedicate.' }
    ];
    return h('div', { className: 'zr-faq' }, items.map(function (it, i) {
      return h('details', { key: i, className: 'zr-faq-item', open: i === 0 ? true : undefined },
        h('summary', null, h('span', null, it.q), h(Icon, { name: 'plus', size: 18 })),
        h('p', null, it.a));
    }));
  }

export { FAQ };
