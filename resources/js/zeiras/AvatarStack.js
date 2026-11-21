// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AvatarStack di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Avatar } from './interni/Avatar';
import { AVATAR_STACK_TEXTS } from './interni/AVATAR_STACK_TEXTS';
import { tpl } from './interni/tpl';
import { useCompLabels } from './interni/useCompLabels';

  function AvatarStack(p) {
    /* una persona è un nome, o { id, name, initials, tone }: la chiave è l'id, così due persone con lo stesso nome restano due (265, 300) */
    var people = (p.people || []).filter(function (x) { return x != null && x !== ''; }).map(function (x) { return typeof x === 'object' ? x : { name: String(x) }; }), max = p.max || 3;
    var T = useCompLabels(AVATAR_STACK_TEXTS, p.labels);
    var shown = people.slice(0, max), extra = people.length - shown.length;
    var more = extra > 0 ? tpl(extra === 1 ? T.moreOne : T.moreMany, { n: extra }) : null;
    return h('span', { className: 'zr-avatars' },
      shown.map(function (x, i) { return h(Avatar, { key: x.id != null ? 'id-' + x.id : 'n-' + i, name: x.name, initials: x.initials, tone: x.tone, size: p.size || 'sm' }); }),
      extra > 0 ? h('span', { className: cx('zr-avatar', 'zr-avatar-' + (p.size || 'sm'), 'zr-label-neutral'), role: 'img', 'aria-label': more, title: more }, '+' + extra) : null);
  }

export { AvatarStack };
