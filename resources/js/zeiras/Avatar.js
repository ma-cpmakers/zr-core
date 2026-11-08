// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Avatar di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { initials, toneFor } from './interni/initials';
import { AvatarStack } from './AvatarStack';

  function Avatar(p) {
    var size = p.size || 'md';
    var failSt = useState(null), failed = failSt[0], setFailed = failSt[1];
    var photo = p.src && failed !== p.src ? p.src : null; /* senza foto, o se non si carica: le iniziali */
    return h('span', {
      className: cx('zr-avatar', 'zr-avatar-' + size, 'zr-label-' + (p.tone || toneFor(p.name)), photo && 'has-photo', p.className),
      title: p.decorative ? undefined : p.name, role: p.decorative ? undefined : 'img', 'aria-label': p.decorative ? undefined : p.name, 'aria-hidden': p.decorative ? 'true' : undefined /* decorative: il nome è già accanto (richiesta 109) */
    }, initials(p.name), photo ? h('img', { className: 'zr-avatar-img', src: photo, alt: '', onError: function () { setFailed(photo); } }) : null);
  }
  Avatar.Stack = AvatarStack;

export { Avatar };
