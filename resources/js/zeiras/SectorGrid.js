// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È SectorGrid di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Label } from './Label';

  /* ---------- SectorGrid: le verticalizzazioni, ognuna con la sua pagina ---------- */
  var SAMPLE_SECTORS = [
    { title: 'Palestre e personal trainer', text: 'Dalla prova all’iscrizione, ingressi scalati con un tocco, certificati e rinnovi.', icon: 'target', tone: 'pine', tags: ['Iscritti', 'Abbonamenti', 'Check-in'], href: '#palestre' },
    { title: 'Architetti, geometri e ingegneri', text: 'Richieste, incarichi a fasi legati all’immobile e pratiche con i loro termini.', icon: 'building', tone: 'sky', tags: ['Incarichi', 'Immobili', 'Pratiche'], href: '#tecnici' },
    { title: 'Liberi professionisti', text: 'Primo colloquio, incarichi o percorsi, sedute e ore scalate da pacchetti.', icon: 'user', tone: 'citrus', tags: ['Clienti', 'Sedute', 'Scadenze'], href: '#professionisti' },
    { title: 'Agenzie digitali', text: 'Lead, brief e proposte, contratti con ore a consumo e asset dei clienti.', icon: 'megaphone', tone: 'plum', tags: ['Proposte', 'Contratti', 'Rinnovi'], href: '#agenzie' },
    { title: 'PMI di servizi', text: 'Sopralluoghi, offerte, contratti con canone, interventi e rapportini.', icon: 'settings', tone: 'pine', tags: ['Offerte', 'Interventi', 'Impianti'], href: '#pmi' },
    { title: 'Scuole di formazione', text: 'Candidature, iscrizioni a edizioni con posti e rate, presenze e attestati.', icon: 'checklist', tone: 'sky', tags: ['Corsisti', 'Edizioni', 'Attestati'], href: '#formazione' }
  ];
  function SectorGrid(p) {
    var items = p.items || SAMPLE_SECTORS;
    return h('ul', { className: 'zr-sectors' }, items.map(function (x, i) {
      var inner = [
        h('span', { key: 'i', className: cx('zr-iconbox', 'zr-label-' + (x.tone || 'pine')) }, h(Icon, { name: x.icon || 'grid', size: 22 })),
        h('h3', { key: 't' }, x.title),
        x.text ? h('p', { key: 'x' }, x.text) : null,
        x.tags && x.tags.length ? h('div', { key: 'g', className: 'zr-sector-tags' }, x.tags.map(function (t) { return h(Label, { key: t, tone: 'neutral' }, t); })) : null,
        x.href ? h('span', { key: 'c', className: 'zr-tile-go' }, x.cta || p.cta || 'Scopri', h(Icon, { name: 'arrow', size: 16 })) : null
      ];
      return h('li', { key: x.href || i }, x.href ? h('a', { className: 'zr-sector', href: x.href }, inner) : h('div', { className: 'zr-sector' }, inner));
    }));
  }

export { SectorGrid };
