// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È RecordHeader di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { StatusLabel } from './StatusLabel';

  function RecordHeader(p) {
    return h('header', { className: 'zr-record' },
      h(Avatar, { name: p.name, size: 'lg' }),
      h('div', { className: 'zr-record-main' },
        h('div', { className: 'zr-record-title' }, h('h1', null, p.name), p.status ? h(StatusLabel, { status: p.status, tone: p.statusTone }) : null), /* statusTone come tone nelle liste (richiesta 174) */
        p.subtitle ? h('p', null, p.subtitle) : null,
        p.meta ? h('ul', { className: 'zr-record-meta' }, p.meta.map(function (m) { return h('li', { key: m.text }, h(Icon, { name: m.icon, size: 14 }), m.href ? h('a', { href: m.href }, m.text) : m.text); })) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

export { RecordHeader };
