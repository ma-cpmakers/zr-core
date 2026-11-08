// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È CtaBand di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Icon } from './Icon';

  function CtaBand(p) {
    return h('section', { className: 'zr-cta-band' },
      h('div', { className: 'zr-site-wrap zr-cta-inner' },
        h('div', null,
          h('h2', null, p.title || 'Inizia oggi. È gratis.'),
          h('p', null, p.subtitle || 'Crea il tuo spazio in un minuto e porta ordine nei tuoi progetti.')),
        h('a', { href: p.href || '#', className: 'zr-btn zr-btn-lg zr-btn-onpine' }, p.cta || 'Crea il tuo spazio gratis', h(Icon, { name: 'arrow', size: 18 }))));
  }

export { CtaBand };
