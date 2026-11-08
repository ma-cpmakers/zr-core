// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È LandingPage di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { ProductTile } from './ProductTile';
import { SiteHeader } from './SiteHeader';
import { Hero } from './Hero';
import { SectionHeading } from './SectionHeading';
import { StepList } from './StepList';
import { PricingCard } from './PricingCard';
import { FAQ } from './FAQ';
import { CtaBand } from './CtaBand';
import { SiteFooter } from './SiteFooter';

  function LandingPage(p) {
    var products = p.products || [
      { id: 'pm', name: 'Board', icon: 'board', tone: 'pine', description: 'Board Kanban e Gantt: ogni attività ha un responsabile e una scadenza.' },
      { id: 'crm', name: 'CRM', icon: 'users', tone: 'sky', description: 'Ogni cliente e ogni trattativa con il passo successivo.' },
      { id: 'bookings', name: 'Bookings', icon: 'calendar', tone: 'sky', description: 'I clienti prenotano da soli: slot, posti, conferme e promemoria.' },
      { id: 'reports', name: 'Report', icon: 'chart', tone: 'citrus', description: 'I numeri che contano, aggiornati da soli.' },
      { id: 'automations', name: 'Automazioni', icon: 'bolt', tone: 'plum', description: 'Promemoria, email e passaggi ripetitivi partono da soli.' },
      { id: 'content', name: 'Contenuti', icon: 'sparkle', tone: 'coral', description: 'Post, email e testi scritti con l’AI nel tuo stile.' },
      { id: 'cashflow', name: 'Flusso di cassa', icon: 'euro', tone: 'citrus', description: 'Entrate, uscite e previsioni di cassa.' },
      { id: 'marketing', name: 'Marketing', icon: 'megaphone', tone: 'plum', description: 'Campagne, liste e risultati in un posto.' },
      { id: 'collaboration', name: 'Area di collaborazione', icon: 'message', tone: 'sky', description: 'File, messaggi e approvazioni con clienti e collaboratori.' },
      { id: 'integrations', name: 'Integrazioni', icon: 'link', tone: 'pine', description: 'Collega Zeiras alle tue app con Zapier e Make.' }
    ];
    var plans = p.plans || [
      { name: 'Personale', badge: 'Per sempre', featured: true, price: '0 €', period: '/ mese', description: 'Per te e i tuoi progetti. Nessuna scadenza.', features: ['Tutti i 10 prodotti', 'Board, liste e schede illimitate', 'Il modello del tuo settore incluso'], cta: 'Crea il tuo spazio gratis' },
      { name: 'Business', badge: 'A pagamento', price: 'Su misura', description: 'Il piano a pagamento per aziende, studi, scuole e palestre che lavorano insieme.', features: ['Le stesse board, modificate insieme', 'Workspace del team, ruoli e permessi', 'Supporto dedicato e avvio guidato'], cta: 'Contattaci', href: '#contatti' }
    ];
    return h('div', { className: 'zr-site' },
      h(SiteHeader, { signupHref: p.signupHref, loginHref: p.loginHref }),
      h('main', null,
        h(Hero, { signupHref: p.signupHref }),
        h('section', { id: 'prodotti', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'La suite', title: '10 strumenti. Un solo accesso. Zero euro.', subtitle: 'Tutto quello che ti serve per vendere, organizzare e incassare, già collegato.' }),
          h('div', { className: 'zr-grid-3', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' } }, products.map(function (x) { return h(ProductTile, Object.assign({ key: x.id, cta: 'Prova gratis' }, x, { href: x.status === 'soon' ? undefined : (p.signupHref || '#') })); })))),
        h('section', { id: 'come-funziona', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Come funziona', title: 'Operativo in tre passi' }),
          h(StepList, null))),
        h('section', { id: 'prezzi', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Prezzi', title: '0 €. Per sempre.', subtitle: 'Non è una prova: per i tuoi progetti Zeiras resta gratis. Paghi solo la versione Business, per lavorare in team.', align: 'center' }),
          h('div', { className: 'zr-prices' }, plans.map(function (x) { return h(PricingCard, Object.assign({ key: x.name, href: x.href || p.signupHref }, x)); })))),
        h('section', { id: 'faq', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap zr-faq-wrap' },
          h(SectionHeading, { overline: 'Domande frequenti', title: 'Le risposte prima delle domande' }),
          h(FAQ, null))),
        h(CtaBand, { href: p.signupHref })),
      h(SiteFooter, null));
  }

export { LandingPage };
