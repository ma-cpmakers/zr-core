// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È PricingCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Label } from './Label';
import { PRICING_LABELS } from './interni/PRICING_LABELS';

  function PricingCard(p) {
    var L = Object.assign({}, PRICING_LABELS, p.labels || {});
    var soon = p.status === 'soon';
    return h('article', { className: cx('zr-price', p.featured && 'is-featured', soon && 'is-soon') },
      h('header', null,
        h('div', { className: 'zr-price-top' }, h('h3', null, p.name), soon ? h(Label, null, L.soon) : (p.badge ? h(Label, { tone: 'pine' }, p.badge) : null)),
        h('p', { className: 'zr-price-desc' }, p.description)),
      h('div', { className: 'zr-price-amount' }, h('strong', null, p.price), p.period ? h('span', null, p.period) : null),
      h('ul', { className: 'zr-price-list' }, (p.features || []).map(function (f, i) {
        return h('li', { key: i }, h(Icon, { name: 'checklist', size: 16 }), h('span', null, f));
      })),
      soon ? h('button', { type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-md', disabled: true }, p.cta || L.soonCta)
        : h('a', { href: p.href || '#', className: cx('zr-btn', 'zr-btn-md', p.featured ? 'zr-btn-primary' : 'zr-btn-secondary') }, p.cta || L.cta));
  }

export { PricingCard };
