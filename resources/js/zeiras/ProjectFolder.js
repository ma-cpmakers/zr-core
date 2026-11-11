// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ProjectFolder di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Button } from './Button';

  /* ---------- ProjectFolder ---------- */
  function ProjectFolder(p) {
    var boards = p.boards || [];
    var total = boards.reduce(function (a, b) { return a + (b.cards || 0); }, 0);
    return h('section', { className: 'zr-folder' },
      h('header', { className: 'zr-folder-head' },
        h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + (p.tone || 'citrus')) }, h(Icon, { name: 'folder', size: 18 })),
        h('div', { className: 'zr-folder-title' },
          h('h3', null, p.name),
          h('span', null, boards.length + (boards.length === 1 ? ' board' : ' board') + ' · ' + total + ' schede' + (p.updated ? ' · ' + p.updated : ''))),
        h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': 'Azioni area' })),
      h('ul', { className: 'zr-folder-boards' },
        boards.map(function (b) {
          return h('li', { key: b.name },
            h('a', { href: b.href || '#', onClick: function (e) { if (!b.href) e.preventDefault(); if (p.onOpenBoard) p.onOpenBoard(b); } },
              h(Icon, { name: 'board', size: 16 }),
              h('span', { className: 'zr-folder-board' }, b.name),
              h('span', { className: 'zr-folder-count' }, b.cards || 0)));
        }),
        h('li', { key: '__new' }, h('button', { type: 'button', className: 'zr-folder-new', onClick: p.onNewBoard }, h(Icon, { name: 'plus', size: 16 }), h('span', null, 'Nuova board')))));
  }

export { ProjectFolder };
