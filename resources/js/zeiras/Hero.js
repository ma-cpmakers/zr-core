// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Hero di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Icon } from './Icon';
import { HeroPreview } from './interni/HERO_PREVIEW';

  function Hero(p) {
    return h('section', { className: 'zr-hero' },
      h('div', { className: 'zr-site-wrap zr-hero-grid' },
        h('div', { className: 'zr-hero-copy' },
          h('span', { className: 'zr-hero-kicker' }, p.kicker || 'Gratis, senza limiti per i progetti personali'),
          h('h1', { className: 'zr-hero-title' }, p.title || 'Tutto il tuo lavoro, in un posto.'),
          h('p', { className: 'zr-hero-sub' }, p.subtitle || 'Project management, CRM, report, automazioni e contenuti AI in un’unica suite semplice. Inizia con le board Kanban: pronte in un minuto.'),
          h('div', { className: 'zr-hero-actions' },
            h('a', { href: p.signupHref || '#', className: 'zr-btn zr-btn-primary zr-btn-lg' }, p.cta || 'Crea il tuo spazio gratis', h(Icon, { name: 'arrow', size: 18 })),
            h('a', { href: p.secondaryHref || '#come-funziona', className: 'zr-btn zr-btn-secondary zr-btn-lg' }, p.secondaryCta || 'Come funziona')),
          h('p', { className: 'zr-hero-note' }, p.note || 'Nessuna carta di credito · Nessun limite di board')),
        p.visual || h(HeroPreview, { preview: p.preview })));
  }

export { Hero };
