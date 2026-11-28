// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Avatar di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) senza la proprietà che il bundle gli dà:
// i moduli lo importano da qui, e ../Avatar.js gliela dà per chi lo prende per nome.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './h';
import { useState } from './useState';
import { cx } from './cx';
import { initials, toneFor } from './initials';

  function Avatar(p) {
    var size = p.size || 'md';
    var failSt = useState(null), failed = failSt[0], setFailed = failSt[1];
    var photo = p.src && failed !== p.src ? p.src : null; /* senza foto, o se non si carica: le iniziali */
    return h('span', {
      className: cx('zr-avatar', 'zr-avatar-' + size, 'zr-label-' + (p.tone || toneFor(p.name)), photo && 'has-photo', p.className),
      title: p.decorative ? undefined : p.name, role: p.decorative ? undefined : 'img', 'aria-label': p.decorative ? undefined : p.name, 'aria-hidden': p.decorative ? 'true' : undefined /* decorative: il nome è già accanto (richiesta 109) */
    }, String(p.initials || '').trim() || initials(p.name), photo ? h('img', { className: 'zr-avatar-img', src: photo, alt: '', onError: function () { setFailed(photo); } }) : null);
  }

export { Avatar };
