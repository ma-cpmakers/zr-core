// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È SiteFooter di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Logo } from './Logo';
import { LanguageSwitch } from './LanguageSwitch';
import { PUBLISHER } from './PUBLISHER';
import { SITE_FOOTER_LABELS } from './interni/SITE_FOOTER_LABELS';

  function SiteFooter(p) {
    var L = Object.assign({}, SITE_FOOTER_LABELS, p.labels || {});
    var co = Object.assign({}, PUBLISHER, p.company || {});
    /* l'ufficio del Registro delle Imprese col numero d'iscrizione, che per una società è il C.F. (art. 2250 c.c., richiesta 218): un titolare con la sua P. IVA non eredita l'ufficio di Zeiras */
    var registry = p.company && 'vat' in p.company && p.company.vat !== PUBLISHER.vat && !p.company.registry ? null : co.registry, regNo = co.registryNumber || co.taxCode || co.vat;
    var cols = p.columns || [
      { title: 'Moduli', links: ['Board', 'CRM', 'Bookings', 'Finanze', 'Prezzi'] },
      { title: 'Risorse', links: ['Guida introduttiva', 'Modelli di board', 'Novità', 'Stato del servizio'] },
      { title: 'Azienda', links: ['Chi siamo', 'Contatti', 'Lavora con noi', 'Stampa'] }
    ];
    var legalLinks = p.legalLinks || [
      { label: 'Privacy policy', href: '#privacy' }, { label: 'Cookie policy', href: '#cookie' },
      { label: 'Preferenze cookie', onClick: p.onCookiePreferences }, { label: 'Termini di servizio', href: '#termini' },
      { label: 'Note legali', href: '#note-legali' }, { label: 'Accessibilità', href: '#accessibilita' }
    ];
    function val(v, label) { return v ? v : h('span', { className: 'zr-foot-missing', title: L.missing }, '[' + label + ']'); }
    var fullName = co.legalForm ? co.name + ' ' + co.legalForm : co.name;
    var items = [
      [L.registeredOffice, val(co.address, 'indirizzo sede legale')],
      [co.taxCode ? L.vat : L.vatTax, val(co.vat, 'partita IVA')],
      [L.taxCode, co.taxCode || null],
      [L.rea, co.rea || null], /* il n. REA solo se il titolare lo passa: nei dati di Zeiras non c'è, e non ha segnaposto */
      [L.capital, co.capital ? co.capital + ' ' + L.paidUp : val(null, 'capitale sociale i.v.')],
      [L.registry, registry && regNo ? registry + ' ' + L.registryNo + ' ' + regNo : null], /* senza ufficio o senza numero la riga non c'è */
      [L.pec, co.pec ? h('a', { href: 'mailto:' + co.pec }, co.pec) : val(null, 'indirizzo PEC')],
      [L.email, co.email ? h('a', { href: 'mailto:' + co.email }, co.email) : null],
      [L.phone, co.phone || null]
    ].filter(function (x) { return x[1] != null; });
    return h('footer', { className: 'zr-site-foot' },
      h('div', { className: 'zr-site-wrap zr-foot-grid', style: { '--foot-cols': cols.length } },
        h('div', { className: 'zr-foot-brand' },
          h(Logo, { size: 24 }),
          h('p', null, p.tagline || L.tagline),
          h('p', { className: 'zr-foot-by' }, L.by + ' ', h('strong', null, co.name)),
          p.languages && p.languages.length ? h(LanguageSwitch, { languages: p.languages, label: L.language }) : null),
        cols.map(function (c) {
          return h('nav', { key: c.title, className: 'zr-foot-col', 'aria-label': c.title },
            h('h3', null, c.title),
            c.links.map(function (l) {
              var t = typeof l === 'string' ? l : l.label;
              /* Pagina non ancora pubblicata: testo senza link, con «In arrivo» (labels.soon) */
              if (l && typeof l === 'object' && !l.href) return h('span', { key: t, className: 'zr-foot-nolink' }, t, l.soon ? h('span', { className: 'zr-foot-soon' }, L.soon) : null);
              return h('a', { key: t, href: (l && l.href) || '#' }, t);
            }));
        })),
      h('div', { className: 'zr-site-wrap zr-foot-company' },
        h('p', { className: 'zr-foot-company-line' },
          h('strong', null, fullName),
          items.map(function (x) { return h('span', { key: x[0] }, x[0] + ': ', x[1]); }))),
      h('div', { className: 'zr-site-wrap zr-foot-legal' },
        h('span', null, p.legal || '© ' + new Date().getFullYear() + ' ' + fullName + (/\.$/.test(fullName) ? '' : '.') + ' ' + L.rights),
        h('nav', { className: 'zr-foot-legal-links', 'aria-label': L.legalNav },
          legalLinks.map(function (l) {
            if (l.href) return h('a', { key: l.label, href: l.href }, l.label);
            if (l.onClick) return h('button', { key: l.label, type: 'button', onClick: l.onClick }, l.label);
            return h('span', { key: l.label, className: 'zr-foot-nolink' }, l.label, l.soon ? h('span', { className: 'zr-foot-soon' }, L.soon) : null);
          }))));
  }

export { SiteFooter };
