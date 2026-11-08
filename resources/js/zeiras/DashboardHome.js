// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È DashboardHome di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Button } from './Button';
import { ProductTile } from './ProductTile';
import { ProjectFolder } from './ProjectFolder';

  /* ---------- DashboardHome ---------- */
  var SAMPLE_PRODUCTS = [
    { id: 'pm', name: 'Board', icon: 'board', tone: 'pine', description: 'Board Kanban in aree: organizza attività, scadenze e persone.', meta: '2 aree · 5 board' },
    { id: 'crm', name: 'CRM', icon: 'users', tone: 'sky', description: 'Contatti, aziende e trattative in una pipeline semplice.', meta: '248 contatti · 12 trattative' },
    { id: 'reports', name: 'Report', icon: 'chart', tone: 'citrus', description: 'Dashboard di marketing, vendite e attività, sempre aggiornate.', meta: '3 dashboard' },
    { id: 'automations', name: 'Automazioni', icon: 'bolt', tone: 'plum', description: 'Quando succede qualcosa, Zeiras fa il resto: email, attività, avvisi.', meta: '4 attive' },
    { id: 'content', name: 'Contenuti', icon: 'sparkle', tone: 'coral', description: 'Genera post, email e articoli con l’AI, nel tuo tono di voce.', meta: '18 generati questo mese' }
  ];
  var SAMPLE_FOLDERS = [
    { name: 'Corsi 2026', tone: 'citrus', updated: 'aggiornata oggi', boards: [{ name: 'Lancio corso Leadership', cards: 8 }, { name: 'Calendario webinar', cards: 12 }, { name: 'Faculty e docenti', cards: 5 }] },
    { name: 'Personale', tone: 'sky', updated: 'aggiornata ieri', boards: [{ name: 'Ristrutturazione casa', cards: 14 }, { name: 'Viaggi', cards: 3 }] }
  ];
  function DashboardHome(p) {
    var products = p.products || SAMPLE_PRODUCTS;
    var folders = p.folders || SAMPLE_FOLDERS;
    var first = String(p.user || 'Luciano').split(' ')[0];
    return h('div', { className: 'zr-home' },
      h('div', { className: 'zr-home-hero' },
        h('div', null,
          h('h1', { className: 'zr-home-title' }, (p.greeting || 'Buongiorno') + ', ' + first),
          h('p', { className: 'zr-home-sub' }, p.subtitle || 'Tutti i tuoi strumenti Zeiras in un solo posto.')),
        h(Button, { icon: 'plus', onClick: p.onNewBoard }, 'Nuova board')),
      h('section', { className: 'zr-home-section' },
        h('h2', { className: 'zr-home-h2' }, 'I tuoi prodotti'),
        h('div', { className: 'zr-grid-3' }, products.map(function (x) {
          return h(ProductTile, Object.assign({ key: x.id || x.name }, x, { onOpen: p.onOpenProduct ? function () { p.onOpenProduct(x); } : undefined }));
        }))),
      h('section', { className: 'zr-home-section' },
        h('div', { className: 'zr-home-row' },
          h('h2', { className: 'zr-home-h2' }, 'Aree recenti'),
          h(Button, { variant: 'ghost', size: 'sm', icon: 'folder' }, 'Tutte le aree')),
        h('div', { className: 'zr-grid-2' }, folders.map(function (f) { return h(ProjectFolder, Object.assign({ key: f.name }, f)); }))));
  }

export { DashboardHome };
