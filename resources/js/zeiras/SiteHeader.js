// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È SiteHeader di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { SITE_HEADER_LABELS, SITE_NAV } from './interni/SITE_NAV';
import { LanguageSwitch } from './LanguageSwitch';

  function SiteHeader(p) {
    var nav = p.nav || SITE_NAV;
    var L = Object.assign({}, SITE_HEADER_LABELS, p.labels || {});
    var op = useState(false), open = op[0], setOpen = op[1];
    return h('header', { className: cx('zr-site-head', open && 'is-open') },
      h('div', { className: 'zr-site-wrap zr-site-head-row' },
        h('a', { href: p.homeHref || '#', className: 'zr-site-logo', 'aria-label': L.home }, h(Logo, { size: 26 })),
        h('nav', { className: 'zr-site-nav', 'aria-label': L.nav },
          nav.map(function (n) { return h('a', { key: n.label, href: n.href, onClick: function () { setOpen(false); } }, n.label); })),
        h('div', { className: 'zr-site-cta' },
          p.languages && p.languages.length ? h(LanguageSwitch, { languages: p.languages, variant: 'compact', label: L.language }) : null,
          h('a', { href: p.loginHref || '#', className: 'zr-btn zr-btn-ghost zr-btn-md' }, L.login),
          h('a', { href: p.signupHref || '#', className: 'zr-btn zr-btn-primary zr-btn-md' }, L.signup)),
        h('button', { type: 'button', className: 'zr-btn zr-btn-ghost zr-btn-md zr-btn-icon zr-site-burger', 'aria-label': open ? L.closeMenu : L.openMenu, 'aria-expanded': open, onClick: function () { setOpen(!open); } },
          h(Icon, { name: open ? 'close' : 'menu', size: 20 }))));
  }

export { SiteHeader };
