// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È SectionCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Button } from './Button';

  /* Riquadro di sezione: titolo, azioni a destra, contenuto qualsiasi (dati di una scheda, un elenco, un modulo d'ingresso) */
  var sectionCardUid = 0;
  function SectionCard(p) {
    var idRef = useRef(null); if (!idRef.current) { sectionCardUid += 1; idRef.current = 'zr-section-card-' + sectionCardUid; }
    var tid = idRef.current + '-t';
    var head = p.title || p.actions ? h('header', { className: 'zr-section-card-head' },
      p.title ? h('div', { className: 'zr-section-card-heading' }, h(p.headingLevel === 3 ? 'h3' : 'h2', { id: tid, className: 'zr-section-card-title' }, p.title), p.subtitle ? h('p', { className: 'zr-section-card-sub' }, p.subtitle) : null) : h('span'),
      p.actions ? h('div', { className: 'zr-section-card-actions' }, p.actions) : null) : null;
    return h('section', { id: p.id, className: cx('zr-section-card', p.variant === 'standalone' && 'is-standalone', p.className), 'aria-labelledby': p.title ? tid : undefined, 'aria-label': p.title ? undefined : p['aria-label'] },
      head,
      h('div', { className: 'zr-section-card-body' }, p.children,
        p.more ? h('div', { className: 'zr-section-card-more' }, p.more.href
          ? h('a', { className: 'zr-btn zr-btn-ghost zr-btn-sm', href: p.more.href, onClick: p.more.onClick }, h('span', null, p.more.label))
          : h(Button, { variant: 'ghost', size: 'sm', onClick: p.more.onClick }, p.more.label)) : null),
      p.footer ? h('footer', { className: 'zr-section-card-foot' }, p.footer) : null);
  }

export { SectionCard };
