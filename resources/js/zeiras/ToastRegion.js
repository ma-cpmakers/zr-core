// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ToastRegion di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { toastRegionContext } from './interni/toastRegionCtx';

  function ToastRegion(p) {
    return h('div', { className: cx('zr-toast-region', p.className), 'aria-live': 'polite', 'aria-relevant': 'additions text' }, h(toastRegionContext().Provider, { value: true }, p.children));
  }

export { ToastRegion };
