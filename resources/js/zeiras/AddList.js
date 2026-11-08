// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AddList di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { omit } from './interni/omit';
import { Icon } from './Icon';
import { KANBAN_TEXTS } from './KANBAN_TEXTS';

  /* ---------- AddList: «Aggiungi lista» tratteggiato, anche fuori dalla KanbanBoard (richiesta 148) ---------- */
  function AddList(p) {
    var rest = omit(p, ['label', 'className']);
    return h('button', Object.assign({ type: 'button' }, rest, { className: cx('zr-add-list', p.className) }), h(Icon, { name: 'plus', size: 18 }), h('span', null, p.label || KANBAN_TEXTS.addList));
  }

export { AddList };
