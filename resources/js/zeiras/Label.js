// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Label di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { TONES } from './interni/TONES';
import { useId } from './AppShell';
import { COLOR_TEXTS } from './interni/COLOR_TEXTS';
import { useLabels } from './useLabels';

  function Label(p) {
    var tone = TONES.indexOf(p.tone) >= 0 ? p.tone : 'neutral', vid = useId('lbl'), C = useLabels();
    /* un'etichetta scelta senza nome scrive il nome del suo colore: la tinta da sola sta a 1,1-1,2:1 sul fondo, e il colore da solo non dice niente a chi non lo vede (richiesta 58) */
    var text = p.children == null || p.children === '' || p.children === false ? Object.assign({}, COLOR_TEXTS[C.lang] || COLOR_TEXTS.it, p.colorNames)[tone] : p.children;
    /* variant="type": il tipo di una cosa (Storia, Bug…), a contorno col puntino del tono, da non confondere con le etichette scelte (richiesta 154) */
    if (p.variant === 'type') return h('span', { className: cx('zr-label', 'zr-label-type', p.wrap && 'is-wrap', p.className) }, h('span', { className: cx('zr-label-dot', 'is-' + tone), 'aria-hidden': true }), p.children);
    /* un'etichetta che si aggiunge («+») o si toglie («×»): il nome del pulsante dice anche quale, col testo dell'etichetta anche quando è un nodo (richiesta 143); wrap: una frase lunga va a capo (richiesta 161) */
    if (p.onAdd) return h('button', { type: 'button', className: cx('zr-label', 'zr-label-add', p.wrap && 'is-wrap', p.className), onClick: p.onAdd }, h(Icon, { name: 'plus', size: 14 }), h('span', { className: 'zr-visually-hidden' }, (p.addLabel || C.add) + ': '), p.children);
    return h('span', { className: cx('zr-label', 'zr-label-' + tone, p.wrap && 'is-wrap', p.onRemove && 'has-remove', p.className) }, p.onRemove ? h('span', { id: vid + '-t' }, text) : text,
      p.onRemove ? h('button', { type: 'button', className: 'zr-label-x', onClick: p.onRemove, 'aria-labelledby': vid + ' ' + vid + '-t' }, h('span', { id: vid, className: 'zr-visually-hidden' }, (p.removeLabel || C.remove) + ':'), h(Icon, { name: 'close', size: 12 })) : null);
  }

export { Label };
