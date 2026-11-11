// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ProductTile di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Label } from './Label';
import { PRODUCT_TILE_LABELS } from './interni/PRODUCT_TILE_LABELS';

  function ProductTile(p) {
    var L = Object.assign({}, PRODUCT_TILE_LABELS, p.labels || {});
    var soon = p.status === 'soon';
    var tone = p.tone || 'pine';
    var inner = [
      h('div', { key: 'hd', className: 'zr-tile-head' },
        h('span', { className: cx('zr-iconbox', 'zr-label-' + (soon ? 'neutral' : tone)) }, h(Icon, { name: p.icon || 'grid', size: 22 })),
        h(Label, { tone: soon ? 'neutral' : 'pine' }, soon ? L.soon : L.active)),
      h('div', { key: 'bd', className: 'zr-tile-body' },
        h('h3', { className: 'zr-tile-name' }, p.name),
        p.description ? h('p', { className: 'zr-tile-desc' }, p.description) : null),
      h('div', { key: 'ft', className: 'zr-tile-foot' },
        h('span', null, p.meta || (soon ? L.soonMeta : '')),
        soon ? null : h('span', { className: 'zr-tile-go' }, p.cta || L.open, h(Icon, { name: 'arrow', size: 16 })))
    ];
    if (soon) return h('div', { className: 'zr-tile is-soon', 'aria-disabled': 'true' }, inner);
    return h(p.href ? 'a' : 'button', { className: 'zr-tile', href: p.href, type: p.href ? undefined : 'button', onClick: p.onOpen }, inner);
  }

export { ProductTile };
