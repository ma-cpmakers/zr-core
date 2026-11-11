// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Button di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';

  /* ---------- Button ---------- */
  function Button(p) {
    var v = p.variant || 'primary', s = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'icon', 'className', 'children', 'busy']);
    /* busy: l'azione è partita e si aspetta. Resta raggiungibile col fuoco, ma né il clic né l'invio del modulo partono di nuovo (richiesta 99) */
    if (p.busy) rest = Object.assign(rest, { 'aria-busy': true, 'aria-disabled': true, onClick: function (e) { e.preventDefault(); } });
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('zr-btn', 'zr-btn-' + v, 'zr-btn-' + s, !p.children && 'zr-btn-icon', p.busy && 'is-busy', p.className)
    }), p.busy ? h('span', { className: 'zr-btn-spin', 'aria-hidden': true }) : p.icon ? h(Icon, { name: p.icon, size: s === 'sm' ? 16 : 18 }) : null, p.children ? h('span', null, p.children) : null);
  }

export { Button };
