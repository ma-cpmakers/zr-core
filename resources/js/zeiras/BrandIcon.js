// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È BrandIcon di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { cx } from './interni/cx';
import { BRANDS } from './interni/BRANDS';

  function BrandIcon(p) {
    var id = 'zrb' + React.useId().replace(/[^A-Za-z0-9_-]/g, '');
    var b = BRANDS[p.name];
    if (!b) return null;
    var size = p.size || 20;
    return h('svg', {
      className: cx('zr-brand-icon', p.className), width: size, height: size, viewBox: b.box, focusable: 'false',
      role: p.title ? 'img' : undefined, 'aria-label': p.title || undefined, 'aria-hidden': p.title ? undefined : true,
      dangerouslySetInnerHTML: { __html: b.svg.replace(/__ID__/g, id + '-') }
    });
  }

export { BrandIcon };
