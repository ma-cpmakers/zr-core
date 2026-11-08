// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AppointmentItem di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { StatusLabel } from './StatusLabel';

  /* AppointmentItem: la riga di un appuntamento (Bookings, Il mio spazio). Testi già scritti dal modulo nella sua lingua. */
  function AppointmentItem(p) {
    var past = !!p.past, canceled = p.statusTone === 'coral' || p.canceled;
    var titleId = useRef('zr-appt-' + Math.random().toString(36).slice(2, 8)).current;
    var title = p.href ? h('a', { href: p.href, onClick: p.onOpen, className: 'zr-appt-title', id: titleId }, p.title)
      : p.onOpen ? h('button', { type: 'button', onClick: p.onOpen, className: 'zr-appt-title', id: titleId }, p.title)
      : h('span', { className: 'zr-appt-title', id: titleId }, p.title);
    return h('article', { className: cx('zr-appt', past && 'is-past', canceled && 'is-canceled', p.compact && 'is-compact', p.className), 'aria-labelledby': titleId },
      h('div', { className: 'zr-appt-date', 'aria-hidden': p.dateLabel ? 'true' : undefined },
        h('span', { className: 'zr-appt-wd' }, p.weekday),
        h('span', { className: 'zr-appt-day' }, p.day),
        h('span', { className: 'zr-appt-month' }, p.month)),
      p.dateLabel ? h('span', { className: 'zr-visually-hidden' }, p.dateLabel) : null,
      h('div', { className: 'zr-appt-body' },
        h('div', { className: 'zr-appt-head' }, title, p.status ? h(StatusLabel, { status: p.status, tone: p.statusTone || 'pine' }) : null),
        h('div', { className: 'zr-appt-meta' },
          p.time ? h('span', { className: 'zr-appt-m' }, h(Icon, { name: 'clock', size: 14 }), h('span', null, p.time)) : null,
          p.place ? h('span', { className: 'zr-appt-m' }, h(Icon, { name: p.online ? 'link' : 'home', size: 14 }), h('span', null, p.place)) : null,
          p.provider ? h('span', { className: 'zr-appt-m' }, h('span', { className: 'zr-ws-dot', style: { background: 'var(--' + (p.providerTone || 'pine') + ')' }, 'aria-hidden': 'true' }), h('span', null, p.provider)) : null),
        p.note ? h('p', { className: 'zr-appt-note' }, p.note) : null,
        p.actions ? h('div', { className: 'zr-appt-actions' }, p.actions) : null));
  }

export { AppointmentItem };
