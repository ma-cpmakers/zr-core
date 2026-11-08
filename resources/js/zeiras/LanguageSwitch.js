// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È LanguageSwitch di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { compact } from './interni/compact';

  /* ---------- LanguageSwitch: lingue del sito pubblico (link con hreflang) ---------- */
  function LanguageSwitch(p) {
    var langs = p.languages || [
      { code: 'it', label: 'Italiano', href: '/it/', current: true },
      { code: 'es', label: 'Español', href: '/es/' },
      { code: 'en', label: 'English', href: '/en/' }
    ];
    var compact = p.variant === 'compact';
    return h('nav', { className: cx('zr-lang', compact && 'is-compact', p.className), 'aria-label': p.label || 'Lingua' },
      compact ? h(Icon, { name: 'globe', size: 16 }) : null,
      h('ul', null, langs.map(function (l) {
        return h('li', { key: l.code },
          h('a', { href: l.href || '#', hrefLang: l.code, lang: l.code, className: l.current ? 'is-current' : undefined,
            'aria-current': l.current ? 'true' : undefined, 'aria-label': compact ? l.label : undefined, title: compact ? l.label : undefined },
            compact ? l.code.toUpperCase() : l.label));
      })));
  }

export { LanguageSwitch };
