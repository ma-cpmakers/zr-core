// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È NotificationItem di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { useLabels } from './useLabels';

  /* La riga di una notifica (P-07): la stessa nel pannello della campanella e in una pagina; con href è un link (richiesta 166) */
  function NotificationItem(p) {
    var C = useLabels(), cls = cx('zr-notif-item', p.unread && 'is-unread', p.className);
    return h(p.href ? 'a' : 'button', p.href ? { href: p.href, className: cls, onClick: p.onClick } : { type: 'button', className: cls, onClick: p.onClick },
      p.actor ? h(Avatar, { name: p.actor, size: 'sm' }) : h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + (p.tone || 'neutral')) }, h(Icon, { name: p.icon || 'bell', size: 16 })),
      h('span', { className: 'zr-notif-text' },
        h('span', { className: 'zr-notif-title' }, p.title),
        p.text ? h('span', { className: 'zr-notif-sub' }, p.text) : null,
        (p.time || p.product) ? h('span', { className: 'zr-notif-meta' }, [p.product, p.time].filter(Boolean).join(' · ')) : null),
      p.unread ? h('span', { className: 'zr-notif-dot', 'aria-label': p.unreadLabel || C.unread }) : null);
  }

export { NotificationItem };
