// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AvatarStack di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Avatar } from './Avatar';

  function AvatarStack(p) {
    var people = p.people || [], max = p.max || 3;
    var shown = people.slice(0, max), extra = people.length - shown.length;
    return h('span', { className: 'zr-avatars' },
      shown.map(function (n) { return h(Avatar, { key: n, name: n, size: p.size || 'sm' }); }),
      extra > 0 ? h('span', { className: cx('zr-avatar', 'zr-avatar-' + (p.size || 'sm'), 'zr-label-neutral'), title: extra + ' altri' }, '+' + extra) : null);
  }

export { AvatarStack };
