// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È MODULES_NAV di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- AppShell (portale) ---------- */
  /* Menu dei moduli: unico, uguale in ogni schermata e su telefono (decisione del 21 ott 2026).
     «Modulo» = Board, CRM, Bookings, Finanze…; «prodotto» e «servizio» sono solo le voci del Catalogo del CRM. */
  var MODULES_NAV = { group: 'Moduli', products: true, items: [
    { id: 'home', label: 'Dashboard', icon: 'grid', home: true },
    { id: 'pm', label: 'Board', icon: 'board' },
    { id: 'crm', label: 'CRM', icon: 'users', tone: 'sky' },
    { id: 'bookings', label: 'Bookings', icon: 'calendar', tone: 'sky' },
    { id: 'flow', label: 'Finanze', icon: 'euro', tone: 'pine' },
    { id: 'reports', label: 'Report', icon: 'chart', tone: 'citrus', soon: true },
    { id: 'automations', label: 'Automazioni', icon: 'bolt', tone: 'plum', soon: true },
    { id: 'content', label: 'Contenuti', icon: 'sparkle', tone: 'coral', soon: true }
  ] };

export { MODULES_NAV };
