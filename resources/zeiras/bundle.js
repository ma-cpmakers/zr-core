/* @ds-bundle: {"format":4,"namespace":"Zeiras","components":[{"name":"Logo"},{"name":"Button"},{"name":"Label"},{"name":"Avatar"},{"name":"AppShell"},{"name":"DashboardHome"},{"name":"ProductTile"},{"name":"ProjectFolder"},{"name":"KanbanCard"},{"name":"KanbanColumn"},{"name":"KanbanBoard"},{"name":"LandingPage"},{"name":"SiteHeader"},{"name":"Hero"},{"name":"PricingCard"},{"name":"FAQ"},{"name":"CtaBand"},{"name":"SiteFooter"},{"name":"Icon"},{"name":"Field"},{"name":"Checkbox"},{"name":"Switch"},{"name":"Tabs"},{"name":"Alert"},{"name":"Toast"},{"name":"Dialog"},{"name":"EmptyState"},{"name":"Progress"},{"name":"PageHeader"},{"name":"DataTable"},{"name":"StatCard"},{"name":"LineChart"},{"name":"BarChart"},{"name":"DonutChart"},{"name":"CrmContacts"},{"name":"DealPipeline"},{"name":"DescriptionList"},{"name":"ContactDetail"},{"name":"ReportDashboard"},{"name":"AutomationList"},{"name":"WorkflowBuilder"},{"name":"ContentStudio"},{"name":"DetailPanel"},{"name":"Composer"},{"name":"Menu"},{"name":"SectionHeading"},{"name":"StepList"},{"name":"AudienceGrid"},{"name":"Skeleton"},{"name":"FilterBar"},{"name":"ChartCard"},{"name":"Sparkline"},{"name":"StatusLabel"},{"name":"RecordHeader"},{"name":"ActivityTimeline"},{"name":"DealCard"},{"name":"AutomationStep"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) { if (keys.indexOf(k) < 0) r[k] = o[k]; } return r; }

  /* Icone: tratto 1.75 su griglia 24, angoli arrotondati */
  var PATHS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
    users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M15 4.1a3 3 0 0 1 0 5.8',
    megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    plus: 'M12 5v14M5 12h14',
    calendar: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4',
    checklist: 'M9 11l2 2 4-4M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
    message: 'M4 5h16v11H9l-5 4z',
    bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
    settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    menu: 'M4 6h16M4 12h16M4 18h16',
    chevron: 'M9 6l6 6-6 6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    filter: 'M4 5h16l-6 8v5l-4 2v-7z',
    list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    close: 'M6 6l12 12M18 6L6 18',
    share: 'M12 4v12M7 9l5-5 5 5M5 14v5h14v-5',
    chart: 'M5 20v-9M12 20V5M19 20v-6M3 20h18',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z',
    mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
    building: 'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 10h3a1 1 0 0 1 1 1v10M3 21h18M9 8h2M9 12h2M9 16h2',
    euro: 'M17 6.5A6 6 0 0 0 7 11v2a6 6 0 0 0 10 4.5M5 10h9M5 14h9',
    trendUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    trendDown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
    download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
    upload: 'M12 20V8M7 13l5-5 5 5M5 4h14',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
    refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    tag: 'M3 12V4h8l9 9-8 8zM7.5 8.5h.01',
    star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.4l-5.5 3 1-6.3L3 9.7l6.2-.9z',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
    alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
    xCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',
    split: 'M6 3v18M6 9c0 4 12 2 12 8v4M18 3v3',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    sort: 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4',
    chevronDown: 'M6 9l6 6 6-6',
    chevronLeft: 'M15 6l-6 6 6 6',
    check: 'M5 12l5 5 9-10',
    file: 'M6 3h8l5 5v13H6zM14 3v5h5',
    form: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    gantt: 'M4 4v16M7 7h7M10 12h10M7 17h6'
  };
  var ICON_NAMES = Object.keys(PATHS);

  function Icon(p) {
    var size = p.size || 20;
    return h('svg', {
      className: cx('zr-icon', p.className), width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: p.name === 'more' ? 3 : 1.75,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false'
    }, h('path', { d: PATHS[p.name] || PATHS.more }));
  }

  /* ---------- Button ---------- */
  function Button(p) {
    var v = p.variant || 'primary', s = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'icon', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('zr-btn', 'zr-btn-' + v, 'zr-btn-' + s, !p.children && 'zr-btn-icon', p.className)
    }), p.icon ? h(Icon, { name: p.icon, size: s === 'sm' ? 16 : 18 }) : null, p.children ? h('span', null, p.children) : null);
  }

  /* ---------- Label ---------- */
  var TONES = ['pine', 'citrus', 'coral', 'sky', 'plum', 'neutral'];
  function Label(p) {
    var tone = TONES.indexOf(p.tone) >= 0 ? p.tone : 'neutral';
    return h('span', { className: cx('zr-label', 'zr-label-' + tone, p.className) }, p.children);
  }

  /* ---------- Avatar ---------- */
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function toneFor(name) {
    var s = String(name || ''), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 997;
    return ['pine', 'citrus', 'sky', 'plum', 'coral'][n % 5];
  }
  function Avatar(p) {
    var size = p.size || 'md';
    return h('span', {
      className: cx('zr-avatar', 'zr-avatar-' + size, 'zr-label-' + (p.tone || toneFor(p.name)), p.className),
      title: p.name, role: 'img', 'aria-label': p.name
    }, initials(p.name));
  }
  function AvatarStack(p) {
    var people = p.people || [], max = p.max || 3;
    var shown = people.slice(0, max), extra = people.length - shown.length;
    return h('span', { className: 'zr-avatars' },
      shown.map(function (n) { return h(Avatar, { key: n, name: n, size: p.size || 'sm' }); }),
      extra > 0 ? h('span', { className: cx('zr-avatar', 'zr-avatar-' + (p.size || 'sm'), 'zr-label-neutral'), title: extra + ' altri' }, '+' + extra) : null);
  }
  Avatar.Stack = AvatarStack;

  /* ---------- AppShell (portale) ---------- */
  var DEFAULT_NAV = [
    { group: 'Prodotti', products: true, items: [
      { id: 'home', label: 'Dashboard', icon: 'grid', home: true },
      { id: 'pm', label: 'Project Management', icon: 'board' },
      { id: 'crm', label: 'CRM', icon: 'users', tone: 'sky' },
      { id: 'bookings', label: 'Bookings', icon: 'calendar', tone: 'sky' },
      { id: 'reports', label: 'Report', icon: 'chart', tone: 'citrus' },
      { id: 'automations', label: 'Automazioni', icon: 'bolt', tone: 'plum' },
      { id: 'content', label: 'Contenuti', icon: 'sparkle', tone: 'coral' }
    ] }
  ];

  /* Testi fissi dell'AppShell: tutti sostituibili con la prop labels (it di default) */
  var APPSHELL_LABELS = {
    soon: 'Presto', settings: 'Impostazioni', planTitle: 'Piano Personale', planText: 'Gratis, senza limiti per i progetti personali',
    nav: 'Navigazione principale', openMenu: 'Apri il menu', closeMenu: 'Chiudi il menu', userFallback: 'Utente Zeiras', create: 'Crea',
    workspaceSwitch: 'Cambia workspace', newWorkspace: 'Nuovo workspace',
    search: 'Cerca', searchPlaceholder: 'Cerca progetti, schede, contatti…', searchHint: 'Cerca in tutti i prodotti: scrivi almeno 2 caratteri.',
    searchLoading: 'Sto cercando…', searchEmpty: 'Nessun risultato per', searchEmptyText: 'Prova con un\'altra parola o controlla di essere nel workspace giusto.',
    searchError: 'La ricerca non ha risposto. Riprova tra poco.', searchResults: 'Risultati della ricerca',
    notifications: 'Notifiche', unread: 'non lette', forMe: 'Per me', all: 'Tutte', markAllRead: 'Segna tutte come lette', seeAll: 'Vedi tutte',
    notificationsEmpty: 'Nessuna notifica', notificationsEmptyText: 'Ti avviseremo qui quando qualcuno ti menziona o ti assegna qualcosa.',
    notificationsError: 'Non riusciamo a caricare le notifiche.', retry: 'Riprova', loading: 'Caricamento',
    account: 'Il tuo account', profile: 'Profilo', accountSettings: 'Impostazioni', plan: 'Piano', company: 'Azienda', logout: 'Esci',
    crumbs: 'Percorso'
  };
  var IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

  function useOutside(open, refs, onClose) {
    useEffect(function () {
      if (!open) return;
      function down(e) { for (var i = 0; i < refs.length; i++) { if (refs[i].current && refs[i].current.contains(e.target)) return; } onClose(); }
      var t = setTimeout(function () { document.addEventListener('mousedown', down); document.addEventListener('touchstart', down); }, 0);
      return function () { clearTimeout(t); document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); };
    }, [open]);
  }

  /* Logo: simbolo a tre blocchi (pine, pine-soft, citrus) + nome Zeiras. Colori dai token: cambia da solo nel tema scuro. */
  function Logo(p) {
    p = p || {};
    var size = p.size || 24;
    var mark = h('svg', { className: 'zr-logo-mark', width: Math.round(size * 68 / 64), height: size, viewBox: '0 0 68 64', 'aria-hidden': p.wordmark === false ? undefined : 'true', role: p.wordmark === false ? 'img' : undefined, 'aria-label': p.wordmark === false ? 'Zeiras' : undefined, focusable: 'false' },
      h('rect', { className: 'zr-logo-b1', x: 0, y: 0, width: 34, height: 64, rx: 6 }),
      h('rect', { className: 'zr-logo-b2', x: 38.5, y: 9, width: 29.5, height: 18.5, rx: 5 }),
      h('rect', { className: 'zr-logo-b3', x: 38.5, y: 32, width: 29.5, height: 32, rx: 6 }));
    if (p.wordmark === false) return h('span', { className: cx('zr-logo', p.className) }, mark);
    return h('span', { className: cx('zr-logo', p.className) }, mark, h('span', { className: 'zr-wordmark' }, 'Zeiras'));
  }

  function AppShell(p) {
    var L = Object.assign({}, APPSHELL_LABELS, p.labels);
    var nav = p.nav || DEFAULT_NAV;
    var active = p.active || 'home';
    var user = p.user || L.userFallback;
    var prodGroup = p.product ? nav.find(function (g) { return g.products || g.group === 'Prodotti'; }) : null;
    var current = prodGroup ? prodGroup.items.find(function (it) { return it.id === p.product; }) : null;
    var openSt = useState(false), open = openSt[0], setOpen = openSt[1];
    var drawerSt = useState(false), drawer = drawerSt[0], setDrawer = drawerSt[1];
    var popSt = useState(null), pop = popSt[0], setPop = popSt[1]; /* 'ws' | 'notif' | 'profile' | 'search' */
    var createSt = useState(null), createAt = createSt[0], setCreateAt = createSt[1];
    var qSt = useState(''), q = qSt[0], setQ = qSt[1];
    var hiSt = useState(0), hi = hiSt[0], setHi = hiSt[1];
    var tabSt = useState('me'), tab = tabSt[0], setTab = tabSt[1];
    var switchRef = useRef(null), wsRef = useRef(null), wsBtn = useRef(null), bellRef = useRef(null), notifRef = useRef(null);
    var avatarRef = useRef(null), searchRef = useRef(null), inputRef = useRef(null), timer = useRef(null);
    var ids = useRef(null); if (!ids.current) { uid += 1; ids.current = 'zr-shell-' + uid; }
    var sid = ids.current;

    useEffect(function () { if (!drawer) return; function k(e) { if (e.key === 'Escape' && !document.querySelector('.zr-scrim') && !pop) setDrawer(false); } document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); }; }, [drawer, pop]);
    /* Ctrl+K / Cmd+K apre la ricerca da ogni pagina */
    useEffect(function () {
      function k(e) { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setDrawer(false); setPop('search'); if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } } }
      document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); };
    }, []);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    useOutside(pop === 'ws', [wsRef], function () { setPop(null); });
    useOutside(pop === 'notif', [notifRef, bellRef], function () { setPop(null); });
    useOutside(pop === 'search', [searchRef], function () { setPop(null); });
    useEffect(function () {
      if (pop !== 'notif') return;
      function k(e) { if (e.key === 'Escape') { e.stopPropagation(); setPop(null); if (bellRef.current) bellRef.current.focus(); } }
      document.addEventListener('keydown', k, true); return function () { document.removeEventListener('keydown', k, true); };
    }, [pop]);

    function go(it, e) { if (!it.href && e) e.preventDefault(); if (it.soon) return; setOpen(false); setDrawer(false); setPop(null); if (p.onNavigate) p.onNavigate(it.id); }
    function item(it) {
      var isActive = it.id === active;
      return h('a', {
        key: it.id, href: it.href || '#', className: cx('zr-nav-item', isActive && 'is-active', it.soon && 'is-soon'),
        'aria-current': isActive ? 'page' : undefined, 'aria-disabled': it.soon ? 'true' : undefined,
        onClick: function (e) { go(it, e); }
      },
        h(Icon, { name: it.icon, size: 18 }),
        h('span', { className: 'zr-nav-label' }, it.label),
        it.soon ? h('span', { className: 'zr-nav-soon' }, L.soon) : null,
        it.count ? h('span', { className: 'zr-count' }, it.count) : null);
    }

    /* ---- Selettore Azienda › workspace ---- */
    var companies = p.companies || [];
    var curCompany = null, curWs = null;
    companies.forEach(function (c) { (c.workspaces || []).forEach(function (w) { if (w.slug === p.workspaceSlug) { curCompany = c; curWs = w; } }); });
    if (!curCompany && companies.length) { curCompany = companies[0]; curWs = (curCompany.workspaces || [])[0] || null; }
    function wsKeys(e) {
      if (e.key === 'Escape') { e.stopPropagation(); setPop(null); if (wsBtn.current) wsBtn.current.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var list = Array.prototype.slice.call(wsRef.current.querySelectorAll('.zr-ws-item'));
      var i = list.indexOf(document.activeElement); var n = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]; if (n) n.focus();
    }
    useEffect(function () { if (pop === 'ws' && wsRef.current) { var a = wsRef.current.querySelector('.zr-ws-item[aria-current]') || wsRef.current.querySelector('.zr-ws-item'); if (a) a.focus({ preventScroll: true }); } }, [pop]);
    var wsSwitch = companies.length ? h('div', { ref: wsRef, className: cx('zr-ws', pop === 'ws' && 'is-open'), onKeyDown: wsKeys },
      h('button', { ref: wsBtn, type: 'button', className: 'zr-ws-switch', 'aria-expanded': pop === 'ws' ? 'true' : 'false', 'aria-controls': sid + '-ws', 'aria-label': L.workspaceSwitch + ': ' + (curCompany ? curCompany.name + ' › ' : '') + (curWs ? curWs.name : ''),
        onClick: function () { setPop(pop === 'ws' ? null : 'ws'); } },
        h('span', { className: 'zr-ws-text' },
          h('span', { className: 'zr-ws-company' }, curCompany ? curCompany.name : ''),
          h('span', { className: 'zr-ws-name' }, curWs ? curWs.name : '')),
        h(Icon, { name: 'chevronDown', size: 16, className: 'zr-ws-chev' })),
      pop === 'ws' ? h('div', { id: sid + '-ws', className: 'zr-ws-menu', role: 'group', 'aria-label': L.workspaceSwitch },
        companies.map(function (c) {
          return h('div', { key: c.id, className: 'zr-ws-group' },
            h('div', { className: 'zr-ws-group-title' }, h(Icon, { name: 'building', size: 14 }), h('span', null, c.name)),
            (c.workspaces || []).map(function (w) {
              var isCur = curWs && w.slug === curWs.slug && c === curCompany;
              return h('button', { key: w.slug, type: 'button', className: cx('zr-ws-item', isCur && 'is-active'), 'aria-current': isCur ? 'true' : undefined,
                onClick: function () { setPop(null); setDrawer(false); if (!isCur && p.onSelectWorkspace) p.onSelectWorkspace(w.slug, c.id); } },
                h('span', { className: 'zr-ws-dot', style: { background: 'var(--' + (w.tone || 'pine') + ')' }, 'aria-hidden': 'true' }),
                h('span', { className: 'zr-nav-label' }, w.name),
                isCur ? h(Icon, { name: 'check', size: 16 }) : null);
            }));
        }),
        p.onNewWorkspace ? h('div', { className: 'zr-product-sep', role: 'separator' }) : null,
        p.onNewWorkspace ? h('button', { type: 'button', className: 'zr-ws-item zr-ws-new', onClick: function () { setPop(null); setDrawer(false); p.onNewWorkspace(curCompany ? curCompany.id : undefined); } },
          h(Icon, { name: 'plus', size: 16 }), h('span', { className: 'zr-nav-label' }, L.newWorkspace)) : null) : null)
      : (p.workspace ? h('span', { className: 'zr-workspace' }, p.workspace) : null);

    /* ---- Menu Prodotti collassabile ---- */
    var switcher = current ? h('div', { className: cx('zr-product', open && 'is-open') },
      h('button', {
        ref: switchRef, type: 'button', className: 'zr-product-switch', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': sid + '-products',
        onClick: function () { setOpen(!open); },
        onKeyDown: function (e) { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }
      },
        h('span', { className: cx('zr-iconbox', 'zr-product-icon', 'zr-label-' + (current.tone || 'pine')) }, h(Icon, { name: current.icon, size: 18 })),
        h('span', { className: 'zr-product-text' }, h('span', { className: 'zr-product-over' }, prodGroup.group), h('span', { className: 'zr-product-name' }, current.label)),
        h(Icon, { name: 'chevronDown', size: 16, className: 'zr-product-chev' })),
      open ? h('div', {
        id: sid + '-products', className: 'zr-product-menu', role: 'group', 'aria-label': prodGroup.group,
        onKeyDown: function (e) { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); if (switchRef.current) switchRef.current.focus(); } }
      }, prodGroup.items.map(function (it) {
        var isCur = it.id === current.id;
        return h('a', {
          key: it.id, href: it.href || '#', className: cx('zr-nav-item', isCur && 'is-active', it.soon && 'is-soon'),
          'aria-current': isCur ? 'true' : undefined, 'aria-disabled': it.soon ? 'true' : undefined,
          onClick: function (e) { if (!it.href) e.preventDefault(); if (isCur) { setOpen(false); return; } go(it, e); }
        },
          h(Icon, { name: it.icon, size: 18 }),
          h('span', { className: 'zr-nav-label' }, it.label),
          it.soon ? h('span', { className: 'zr-nav-soon' }, L.soon) : isCur ? h(Icon, { name: 'check', size: 16 }) : null);
      }).reduce(function (acc, el, i) { acc.push(el); var it = prodGroup.items[i]; if (it.home && i < prodGroup.items.length - 1) acc.push(h('div', { key: 'sep', className: 'zr-product-sep', role: 'separator' })); return acc; }, [])) : null) : null;
    var groups = nav.filter(function (g) { return !(prodGroup && g === prodGroup); });

    /* ---- Ricerca ---- */
    var results = p.searchResults || [];
    var sState = p.searchState || 'ready';
    var showPanel = pop === 'search';
    function runSearch(v) {
      setQ(v); setHi(0); setPop('search');
      clearTimeout(timer.current);
      if (v.trim().length >= 2 && p.onSearch) timer.current = setTimeout(function () { p.onSearch(v.trim()); }, 300);
    }
    function pick(r) { if (!r) return; setPop(null); if (inputRef.current) inputRef.current.blur(); if (p.onSelectResult) p.onSelectResult(r); }
    function searchKeys(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPop(null); e.currentTarget.blur(); return; }
      if (!showPanel || q.trim().length < 2 || !results.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % results.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi + results.length - 1) % results.length); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(results[hi]); }
    }
    var qOk = q.trim().length >= 2;
    var panelBody;
    if (!qOk) panelBody = h('p', { className: 'zr-search-note' }, L.searchHint);
    else if (sState === 'loading') panelBody = h('div', { className: 'zr-search-note', role: 'status' }, h('span', { className: 'zr-visually-hidden' }, L.searchLoading), h(Skeleton, { lines: 3 }));
    else if (sState === 'error') panelBody = h('p', { className: 'zr-search-note is-error', role: 'alert' }, L.searchError);
    else if (!results.length) panelBody = h('div', { className: 'zr-search-note', role: 'status' }, h('strong', null, L.searchEmpty + ' «' + q.trim() + '»'), h('span', null, L.searchEmptyText));
    else {
      var lastGroup = null, rows = [];
      results.forEach(function (r, i) {
        if (r.group && r.group !== lastGroup) { lastGroup = r.group; rows.push(h('div', { key: 'g' + i, className: 'zr-search-group', role: 'presentation' }, r.group)); }
        rows.push(h('div', { key: r.id || i, id: sid + '-r' + i, role: 'option', 'aria-selected': i === hi ? 'true' : 'false', className: cx('zr-search-item', i === hi && 'is-active'),
          onMouseDown: function (e) { e.preventDefault(); }, onMouseEnter: function () { setHi(i); }, onClick: function () { pick(r); } },
          h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + (r.tone || 'neutral')) }, h(Icon, { name: r.icon || 'file', size: 16 })),
          h('span', { className: 'zr-search-text' }, h('span', { className: 'zr-search-title' }, r.title), r.subtitle ? h('span', { className: 'zr-search-sub' }, r.subtitle) : null),
          r.product ? h('span', { className: 'zr-search-product' }, r.product) : null));
      });
      panelBody = h('div', { id: sid + '-results', role: 'listbox', 'aria-label': L.searchResults }, rows);
    }
    var listOpen = showPanel && qOk && sState === 'ready' && results.length > 0;

    /* ---- Notifiche ---- */
    var notes = p.notifications || [];
    var nState = p.notificationsState || 'ready';
    var unread = p.unreadCount != null ? p.unreadCount : notes.filter(function (n) { return n.unread; }).length;
    var shown = tab === 'me' ? notes.filter(function (n) { return n.forMe !== false; }) : notes;
    var notifBody;
    if (nState === 'loading') notifBody = h('div', { className: 'zr-notif-state', role: 'status' }, h('span', { className: 'zr-visually-hidden' }, L.loading), h(Skeleton, { lines: 4 }));
    else if (nState === 'error') notifBody = h('div', { className: 'zr-notif-state', role: 'alert' }, h('p', null, L.notificationsError), p.onRetryNotifications ? h(Button, { variant: 'secondary', size: 'sm', icon: 'refresh', onClick: p.onRetryNotifications }, L.retry) : null);
    else if (!shown.length) notifBody = h(EmptyState, { compact: true, icon: 'bell', title: L.notificationsEmpty, text: L.notificationsEmptyText });
    else notifBody = h('ul', { className: 'zr-notif-list' }, shown.map(function (n) {
      return h('li', { key: n.id },
        h('button', { type: 'button', className: cx('zr-notif-item', n.unread && 'is-unread'), onClick: function () { setPop(null); if (p.onOpenNotification) p.onOpenNotification(n); } },
          n.actor ? h(Avatar, { name: n.actor, size: 'sm' }) : h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + (n.tone || 'neutral')) }, h(Icon, { name: n.icon || 'bell', size: 16 })),
          h('span', { className: 'zr-notif-text' },
            h('span', { className: 'zr-notif-title' }, n.title),
            n.text ? h('span', { className: 'zr-notif-sub' }, n.text) : null,
            (n.time || n.product) ? h('span', { className: 'zr-notif-meta' }, [n.product, n.time].filter(Boolean).join(' · ')) : null),
          n.unread ? h('span', { className: 'zr-notif-dot', 'aria-label': L.unread }) : null));
    }));
    var notifPanel = pop === 'notif' ? h('div', { ref: notifRef, id: sid + '-notif', className: 'zr-pop zr-notif', role: 'dialog', 'aria-label': L.notifications },
      h('header', { className: 'zr-pop-head' },
        h('h2', null, L.notifications, unread ? h('span', { className: 'zr-count' }, unread) : null),
        unread && p.onMarkAllRead ? h(Button, { variant: 'ghost', size: 'sm', onClick: p.onMarkAllRead }, L.markAllRead) : null),
      h('div', { className: 'zr-notif-tabs', role: 'tablist' },
        [['me', L.forMe], ['all', L.all]].map(function (t) { return h('button', { key: t[0], type: 'button', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', className: cx('zr-tab', tab === t[0] && 'is-active'), onClick: function () { setTab(t[0]); } }, t[1]); })),
      h('div', { className: 'zr-pop-body' }, notifBody),
      p.onAllNotifications ? h('footer', { className: 'zr-pop-foot' }, h(Button, { variant: 'secondary', size: 'sm', icon: 'arrow', onClick: function () { setPop(null); p.onAllNotifications(); } }, L.seeAll)) : null) : null;

    /* ---- Menu del profilo ---- */
    function acc(id) { return function () { setPop(null); if (p.onAccount) p.onAccount(id); }; }
    var profileItems = p.accountItems || [
      { icon: 'user', label: L.profile, onClick: acc('profile') },
      { icon: 'settings', label: L.accountSettings, onClick: acc('settings') },
      { icon: 'star', label: L.plan, onClick: acc('plan') },
      { icon: 'building', label: L.company, onClick: acc('company') },
      { sep: true },
      { icon: 'arrow', label: L.logout, onClick: acc('logout') }
    ];

    /* ---- Percorso ---- */
    var crumbs = p.crumbs && p.crumbs.length ? h('nav', { className: 'zr-crumbs zr-shell-crumbs', 'aria-label': L.crumbs },
      p.crumbs.map(function (c, i) {
        var last = i === p.crumbs.length - 1;
        return [i ? h(Icon, { key: 'i' + i, name: 'chevron', size: 14 }) : null,
          last ? h('span', { key: 'c' + i, 'aria-current': 'page' }, c.label)
            : h('a', { key: 'c' + i, href: c.href || '#', onClick: function (e) { if (!c.href) e.preventDefault(); if (p.onCrumb) p.onCrumb(c, i); } }, c.label)];
      })) : null;

    var settingsItem = { id: 'settings', label: L.settings, icon: 'settings', href: p.settingsHref };
    var kbd = IS_MAC ? '⌘K' : 'Ctrl K';
    var unreadText = unread > 99 ? '99+' : String(unread);

    return h('div', { className: cx('zr-shell', drawer && 'is-drawer', p.className) },
      drawer ? h('div', { className: 'zr-side-scrim', 'aria-hidden': 'true', onClick: function () { setDrawer(false); setPop(null); } }) : null,
      h('aside', { className: cx('zr-side', drawer && 'is-open'), id: sid + '-side', 'aria-label': L.nav },
        h('div', { className: cx('zr-brand', 'zr-brand-v2', p.create && 'has-create') },
          h('div', { className: 'zr-brand-row' },
            h(Logo, { size: 24 }),
            p.create && p.create.length ? h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', className: 'zr-create', 'aria-label': p.createLabel || L.create, 'aria-haspopup': 'menu', 'aria-expanded': createAt ? 'true' : 'false',
              onClick: function (e) { setCreateAt(createAt ? null : e.currentTarget); } }) : null),
          wsSwitch),
        createAt ? h(Menu, { anchor: createAt, items: p.create, label: p.createLabel || L.create, onClose: function () { setCreateAt(null); } }) : null,
        switcher,
        h('nav', { className: cx('zr-nav', (open || pop === 'ws') && 'is-dimmed'), 'aria-hidden': open || pop === 'ws' ? 'true' : undefined },
          groups.map(function (g) {
            return h('div', { key: g.group, className: cx('zr-nav-group', (g.products || g.group === 'Prodotti') && 'is-products') },
              h('div', { className: 'zr-nav-title' }, g.group),
              g.items.map(item));
          })),
        h('div', { className: 'zr-side-foot' },
          item(settingsItem),
          h('div', { className: 'zr-plan' },
            h('strong', null, L.planTitle),
            h('span', null, L.planText)))),
      h('header', { className: 'zr-top' },
        h('button', { type: 'button', className: 'zr-btn zr-btn-ghost zr-btn-md zr-top-menu', 'aria-label': drawer ? L.closeMenu : L.openMenu, 'aria-expanded': drawer ? 'true' : 'false', 'aria-controls': sid + '-side', onClick: function () { setDrawer(!drawer); setPop(null); } },
          h(Icon, { name: 'menu', size: 20 }), current ? h('span', { className: 'zr-top-product' }, current.label) : null),
        h('div', { ref: searchRef, className: cx('zr-search', showPanel && 'is-open'), onMouseDown: function (e) { if (e.target === e.currentTarget || (e.target.closest && e.target.closest('.zr-search-icon'))) { e.preventDefault(); if (inputRef.current) inputRef.current.focus(); } } },
          h('span', { className: 'zr-search-icon' }, h(Icon, { name: 'search', size: 18 })),
          h('input', { ref: inputRef, type: 'search', value: q, placeholder: p.searchPlaceholder || L.searchPlaceholder, 'aria-label': L.search, role: 'combobox', 'aria-autocomplete': 'list',
            'aria-expanded': listOpen ? 'true' : 'false', 'aria-controls': listOpen ? sid + '-results' : undefined, 'aria-activedescendant': listOpen ? sid + '-r' + hi : undefined, 'aria-keyshortcuts': IS_MAC ? 'Meta+K' : 'Control+K',
            onFocus: function () { setPop('search'); }, onChange: function (e) { runSearch(e.target.value); }, onKeyDown: searchKeys }),
          h('kbd', null, kbd),
          showPanel ? h('div', { className: 'zr-search-panel' }, panelBody) : null),
        h('div', { className: 'zr-top-actions' },
          p.actions || null,
          h('button', { ref: bellRef, type: 'button', className: cx('zr-btn zr-btn-ghost zr-btn-md zr-btn-icon zr-bell', pop === 'notif' && 'is-active'), 'aria-label': L.notifications + (unread ? ', ' + unreadText + ' ' + L.unread : ''),
            'aria-expanded': pop === 'notif' ? 'true' : 'false', 'aria-controls': sid + '-notif',
            onClick: function () { var next = pop === 'notif' ? null : 'notif'; setPop(next); if (next && p.onNotificationsOpen) p.onNotificationsOpen(); } },
            h(Icon, { name: 'bell', size: 18 }), unread ? h('span', { className: 'zr-bell-count', 'aria-hidden': 'true' }, unreadText) : null),
          h('button', { ref: avatarRef, type: 'button', className: 'zr-avatar-btn', 'aria-label': L.account + ': ' + user, 'aria-haspopup': 'menu', 'aria-expanded': pop === 'profile' ? 'true' : 'false',
            onClick: function () { setPop(pop === 'profile' ? null : 'profile'); } }, h(Avatar, { name: user })),
          notifPanel,
          pop === 'profile' ? h(Menu, { anchor: avatarRef.current, inline: true, label: L.account, items: profileItems, className: 'zr-profile-menu',
        head: h('div', { className: 'zr-profile-head' }, h(Avatar, { name: user }), h('span', null, h('strong', null, user), p.email ? h('span', null, p.email) : null, p.planName ? h('span', null, p.planName) : null)),
        onClose: function () { setPop(null); } }) : null)),
      h('main', { className: cx('zr-main', p.flush && 'is-flush', crumbs && 'has-crumbs') },
        crumbs ? [h('div', { key: 'cb', className: 'zr-crumbbar' }, crumbs), h('div', { key: 'body', className: 'zr-main-body' }, p.children)] : p.children));
  }

  /* ---------- ProductTile ---------- */
  function ProductTile(p) {
    var soon = p.status === 'soon';
    var tone = p.tone || 'pine';
    var inner = [
      h('div', { key: 'hd', className: 'zr-tile-head' },
        h('span', { className: cx('zr-iconbox', 'zr-label-' + (soon ? 'neutral' : tone)) }, h(Icon, { name: p.icon || 'grid', size: 22 })),
        h(Label, { tone: soon ? 'neutral' : 'pine' }, soon ? 'In arrivo' : 'Attivo')),
      h('div', { key: 'bd', className: 'zr-tile-body' },
        h('h3', { className: 'zr-tile-name' }, p.name),
        p.description ? h('p', { className: 'zr-tile-desc' }, p.description) : null),
      h('div', { key: 'ft', className: 'zr-tile-foot' },
        h('span', null, p.meta || (soon ? 'Ti avviseremo al lancio' : '')),
        soon ? null : h('span', { className: 'zr-tile-go' }, p.cta || 'Apri', h(Icon, { name: 'arrow', size: 16 })))
    ];
    if (soon) return h('div', { className: 'zr-tile is-soon', 'aria-disabled': 'true' }, inner);
    return h(p.href ? 'a' : 'button', { className: 'zr-tile', href: p.href, type: p.href ? undefined : 'button', onClick: p.onOpen }, inner);
  }

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
        h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': 'Azioni cartella' })),
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

  /* ---------- KanbanCard ---------- */
  function KanbanCard(p) {
    var cl = p.checklist;
    var done = cl && cl.total > 0 && cl.done >= cl.total;
    var rest = omit(p, ['title', 'labels', 'due', 'overdue', 'checklist', 'comments', 'assignees', 'cover', 'dragging', 'className']);
    return h('article', Object.assign({ tabIndex: 0 }, rest, { className: cx('zr-card', p.dragging && 'is-dragging', p.className) }),
      p.cover ? h('div', { className: cx('zr-card-cover', 'zr-cover-' + p.cover) }) : null,
      p.labels && p.labels.length ? h('div', { className: 'zr-card-labels' }, p.labels.map(function (l, i) { return h(Label, { key: i, tone: l.tone }, l.text); })) : null,
      h('h4', { className: 'zr-card-title' }, p.title),
      (p.due || cl || p.comments || (p.assignees && p.assignees.length)) ? h('div', { className: 'zr-card-meta' },
        p.due ? h('span', { className: cx('zr-meta', p.overdue && 'is-overdue') }, h(Icon, { name: p.overdue ? 'clock' : 'calendar', size: 14 }), p.overdue ? 'Scaduta · ' + p.due : p.due) : null,
        cl ? h('span', { className: cx('zr-meta', done && 'is-done'), title: 'Checklist' }, h(Icon, { name: 'checklist', size: 14 }), cl.done + '/' + cl.total) : null,
        p.comments ? h('span', { className: 'zr-meta', title: 'Commenti' }, h(Icon, { name: 'message', size: 14 }), p.comments) : null,
        p.assignees && p.assignees.length ? h('span', { className: 'zr-card-people' }, h(AvatarStack, { people: p.assignees, max: 3 })) : null) : null);
  }

  /* ---------- KanbanColumn ---------- */
  function KanbanColumn(p) {
    var count = p.count != null ? p.count : React.Children.count(p.children);
    var over = p.limit && count > p.limit;
    var rest = omit(p, ['title', 'count', 'limit', 'children', 'onAdd', 'isOver', 'composer', 'className']);
    return h('section', Object.assign({}, rest, { className: cx('zr-col', p.isOver && 'is-over', p.className), 'aria-label': p.title }),
      h('header', { className: 'zr-col-head' },
        h('h3', null, p.title),
        h('span', { className: cx('zr-count', over && 'is-over'), title: p.limit ? 'Limite WIP ' + p.limit : undefined }, p.limit ? count + '/' + p.limit : count),
        over ? h('span', { className: 'zr-col-warn' }, 'Oltre il limite') : null,
        h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': 'Azioni lista ' + p.title })),
      h('div', { className: 'zr-col-body' }, p.children),
      p.composer || h('button', { type: 'button', className: 'zr-col-add', onClick: p.onAdd }, h(Icon, { name: 'plus', size: 16 }), h('span', null, 'Aggiungi scheda')));
  }

  /* ---------- KanbanBoard ---------- */
  var SAMPLE_LISTS = [
    { id: 'todo', title: 'Da fare', cards: [
      { id: 'c1', title: 'Definire gli obiettivi del corso', labels: [{ text: 'Strategia', tone: 'plum' }], due: '3 ott', checklist: { done: 1, total: 4 }, assignees: ['Luciano Castro'] },
      { id: 'c2', title: 'Raccogliere testimonianze degli ex corsisti', labels: [{ text: 'Marketing', tone: 'sky' }], comments: 2, assignees: ['Costanza Rossi', 'Marco Neri'] },
      { id: 'c3', title: 'Preventivo per lo studio di registrazione', due: '25 set', overdue: true, labels: [{ text: 'Urgente', tone: 'coral' }] }
    ] },
    { id: 'doing', title: 'In corso', limit: 3, cards: [
      { id: 'c4', title: 'Scrivere la scaletta del modulo 2', cover: 'citrus', labels: [{ text: 'Contenuti', tone: 'citrus' }], due: '1 ott', checklist: { done: 3, total: 5 }, comments: 4, assignees: ['Luciano Castro', 'Giulia Bianchi'] },
      { id: 'c5', title: 'Landing page di iscrizione', labels: [{ text: 'Marketing', tone: 'sky' }, { text: 'Design', tone: 'pine' }], assignees: ['Marco Neri'] }
    ] },
    { id: 'review', title: 'In revisione', cards: [
      { id: 'c6', title: 'Email di benvenuto (sequenza 3 invii)', labels: [{ text: 'Marketing', tone: 'sky' }], checklist: { done: 3, total: 3 }, comments: 1, assignees: ['Giulia Bianchi'] }
    ] },
    { id: 'done', title: 'Fatto', cards: [
      { id: 'c7', title: 'Scelta del titolo del corso', labels: [{ text: 'Strategia', tone: 'plum' }], checklist: { done: 2, total: 2 } },
      { id: 'c8', title: 'Apertura della cartella di progetto' }
    ] }
  ];

  function KanbanBoard(p) {
    var st = useState(function () { return JSON.parse(JSON.stringify(p.lists || SAMPLE_LISTS)); });
    var lists = st[0], setLists = st[1];
    var ov = useState(null), overId = ov[0], setOverId = ov[1];
    var dg = useState(null), dragId = dg[0], setDragId = dg[1];
    var ad = useState(null), addingIn = ad[0], setAddingIn = ad[1];
    var tx = useState(''), draft = tx[0], setDraft = tx[1];
    var vw = useState('board'), view = vw[0], setView = vw[1];
    var seq = useRef(100);

    function commit(next) { setLists(next); if (p.onChange) p.onChange(next); }
    function move(cardId, toList, beforeId) {
      var card = null;
      var next = lists.map(function (l) {
        return Object.assign({}, l, { cards: l.cards.filter(function (c) { if (c.id === cardId) { card = c; return false; } return true; }) });
      });
      if (!card) return;
      next = next.map(function (l) {
        if (l.id !== toList) return l;
        var cards = l.cards.slice(), i = beforeId ? cards.findIndex(function (c) { return c.id === beforeId; }) : -1;
        if (i < 0) cards.push(card); else cards.splice(i, 0, card);
        return Object.assign({}, l, { cards: cards });
      });
      commit(next);
    }
    function addCard(listId) {
      var t = draft.trim();
      if (!t) { setAddingIn(null); return; }
      seq.current += 1;
      commit(lists.map(function (l) { return l.id === listId ? Object.assign({}, l, { cards: l.cards.concat([{ id: 'n' + seq.current, title: t }]) }) : l; }));
      setDraft('');
    }
    function addList() {
      seq.current += 1;
      commit(lists.concat([{ id: 'l' + seq.current, title: 'Nuova lista', cards: [] }]));
    }

    var views = [['board', 'Board', 'board'], ['list', 'Lista', 'list'], ['calendar', 'Calendario', 'calendar']];

    return h('div', { className: 'zr-board' },
      h('header', { className: 'zr-board-head' },
        p.crumbs === false ? null : h('nav', { className: 'zr-crumbs', 'aria-label': 'Percorso' },
          h('a', { href: '#' , onClick: function (e) { e.preventDefault(); } }, p.product || 'Project Management'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('a', { href: '#', onClick: function (e) { e.preventDefault(); } }, p.folder || 'Corsi 2026'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('span', { 'aria-current': 'page' }, p.title || 'Lancio corso Leadership')),
        h('div', { className: 'zr-board-titlebar' },
          h('h1', { className: 'zr-board-title' }, p.title || 'Lancio corso Leadership'),
          h('div', { className: 'zr-board-actions' },
            h(AvatarStack, { people: p.members || ['Luciano Castro', 'Giulia Bianchi', 'Marco Neri', 'Costanza Rossi'], max: 3 }),
            h(Button, { variant: 'secondary', size: 'sm', icon: 'filter' }, 'Filtra'),
            h(Button, { variant: 'primary', size: 'sm', icon: 'share' }, 'Condividi'))),
        h('div', { className: 'zr-tabs', role: 'tablist' },
          views.map(function (v) {
            return h('button', { key: v[0], type: 'button', role: 'tab', 'aria-selected': view === v[0], className: cx('zr-tab', view === v[0] && 'is-active'), onClick: function () { setView(v[0]); } }, h(Icon, { name: v[2], size: 16 }), v[1]);
          }))),
      h('div', { className: 'zr-lanes' },
        lists.map(function (l) {
          var composer = addingIn === l.id ? h('div', { className: 'zr-composer' },
            h('textarea', {
              autoFocus: true, rows: 2, value: draft, placeholder: 'Titolo della scheda…', 'aria-label': 'Titolo della nuova scheda',
              onChange: function (e) { setDraft(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(l.id); } if (e.key === 'Escape') { setAddingIn(null); setDraft(''); } }
            }),
            h('div', { className: 'zr-composer-row' },
              h(Button, { size: 'sm', onClick: function () { addCard(l.id); } }, 'Aggiungi'),
              h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': 'Annulla', onClick: function () { setAddingIn(null); setDraft(''); } }))) : null;
          return h(KanbanColumn, {
            key: l.id, title: l.title, count: l.cards.length, limit: l.limit, isOver: overId === l.id && dragId != null,
            composer: composer, onAdd: function () { setAddingIn(l.id); setDraft(''); },
            onDragOver: function (e) { e.preventDefault(); if (overId !== l.id) setOverId(l.id); },
            onDragLeave: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); },
            onDrop: function (e) { e.preventDefault(); if (dragId) move(dragId, l.id, null); setOverId(null); setDragId(null); }
          }, l.cards.map(function (c) {
            return h(KanbanCard, Object.assign({ key: c.id }, c, {
              draggable: true, dragging: dragId === c.id,
              onDragStart: function (e) { setDragId(c.id); try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} },
              onDragEnd: function () { setDragId(null); setOverId(null); },
              onDrop: function (e) { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== c.id) move(dragId, l.id, c.id); setOverId(null); setDragId(null); },
              onClick: p.onOpenCard ? function () { p.onOpenCard(c); } : undefined
            }));
          }));
        }),
        h('button', { type: 'button', className: 'zr-add-list', onClick: addList }, h(Icon, { name: 'plus', size: 18 }), h('span', null, 'Aggiungi lista'))));
  }

  /* ---------- DashboardHome ---------- */
  var SAMPLE_PRODUCTS = [
    { id: 'pm', name: 'Project Management', icon: 'board', tone: 'pine', description: 'Board Kanban in cartelle: organizza attività, scadenze e persone.', meta: '2 cartelle · 5 board' },
    { id: 'crm', name: 'CRM', icon: 'users', tone: 'sky', description: 'Contatti, aziende e trattative in una pipeline semplice.', meta: '248 contatti · 12 trattative' },
    { id: 'reports', name: 'Report', icon: 'chart', tone: 'citrus', description: 'Dashboard di marketing, vendite e attività, sempre aggiornate.', meta: '3 dashboard' },
    { id: 'automations', name: 'Automazioni', icon: 'bolt', tone: 'plum', description: 'Quando succede qualcosa, Zeiras fa il resto: email, attività, avvisi.', meta: '4 attive' },
    { id: 'content', name: 'Contenuti', icon: 'sparkle', tone: 'coral', description: 'Genera post, email e articoli con l’AI, nel tuo tono di voce.', meta: '18 generati questo mese' }
  ];
  var SAMPLE_FOLDERS = [
    { name: 'Corsi 2026', tone: 'citrus', updated: 'aggiornata oggi', boards: [{ name: 'Lancio corso Leadership', cards: 8 }, { name: 'Calendario webinar', cards: 12 }, { name: 'Faculty e docenti', cards: 5 }] },
    { name: 'Personale', tone: 'sky', updated: 'aggiornata ieri', boards: [{ name: 'Ristrutturazione casa', cards: 14 }, { name: 'Viaggi', cards: 3 }] }
  ];
  function DashboardHome(p) {
    var products = p.products || SAMPLE_PRODUCTS;
    var folders = p.folders || SAMPLE_FOLDERS;
    var first = String(p.user || 'Luciano').split(' ')[0];
    return h('div', { className: 'zr-home' },
      h('div', { className: 'zr-home-hero' },
        h('div', null,
          h('h1', { className: 'zr-home-title' }, (p.greeting || 'Buongiorno') + ', ' + first),
          h('p', { className: 'zr-home-sub' }, p.subtitle || 'Tutti i tuoi strumenti Zeiras in un solo posto.')),
        h(Button, { icon: 'plus', onClick: p.onNewBoard }, 'Nuova board')),
      h('section', { className: 'zr-home-section' },
        h('h2', { className: 'zr-home-h2' }, 'I tuoi prodotti'),
        h('div', { className: 'zr-grid-3' }, products.map(function (x) {
          return h(ProductTile, Object.assign({ key: x.id || x.name }, x, { onOpen: p.onOpenProduct ? function () { p.onOpenProduct(x); } : undefined }));
        }))),
      h('section', { className: 'zr-home-section' },
        h('div', { className: 'zr-home-row' },
          h('h2', { className: 'zr-home-h2' }, 'Cartelle recenti'),
          h(Button, { variant: 'ghost', size: 'sm', icon: 'folder' }, 'Tutte le cartelle')),
        h('div', { className: 'zr-grid-2' }, folders.map(function (f) { return h(ProjectFolder, Object.assign({ key: f.name }, f)); }))));
  }

  /* =====================  HOMEPAGE (sito pubblico)  ===================== */
  var SITE_NAV = [
    { label: 'Prodotti', href: '#prodotti' },
    { label: 'Come funziona', href: '#come-funziona' },
    { label: 'Per chi è', href: '#per-chi' },
    { label: 'Prezzi', href: '#prezzi' },
    { label: 'FAQ', href: '#faq' }
  ];

  function SiteHeader(p) {
    var nav = p.nav || SITE_NAV;
    var op = useState(false), open = op[0], setOpen = op[1];
    return h('header', { className: cx('zr-site-head', open && 'is-open') },
      h('div', { className: 'zr-site-wrap zr-site-head-row' },
        h('a', { href: p.homeHref || '#', className: 'zr-site-logo', 'aria-label': 'Zeiras' }, h(Logo, { size: 26 })),
        h('nav', { className: 'zr-site-nav', 'aria-label': 'Sito' },
          nav.map(function (n) { return h('a', { key: n.label, href: n.href, onClick: function () { setOpen(false); } }, n.label); })),
        h('div', { className: 'zr-site-cta' },
          h('a', { href: p.loginHref || '#', className: 'zr-btn zr-btn-ghost zr-btn-md' }, 'Accedi'),
          h('a', { href: p.signupHref || '#', className: 'zr-btn zr-btn-primary zr-btn-md' }, 'Inizia gratis')),
        h('button', { type: 'button', className: 'zr-btn zr-btn-ghost zr-btn-md zr-btn-icon zr-site-burger', 'aria-label': open ? 'Chiudi menu' : 'Apri menu', 'aria-expanded': open, onClick: function () { setOpen(!open); } },
          h(Icon, { name: open ? 'close' : 'list', size: 20 }))));
  }

  function HeroPreview() {
    return h('div', { className: 'zr-hero-shot', 'aria-hidden': true },
      h('div', { className: 'zr-hero-shot-bar' }, h('i'), h('i'), h('i'), h('span', null, 'Lancio corso · Board')),
      h('div', { className: 'zr-hero-shot-lanes' },
        h('div', { className: 'zr-hero-lane' }, h('div', { className: 'zr-hero-lane-t' }, 'Da fare'),
          h(KanbanCard, { title: 'Definire gli obiettivi', labels: [{ text: 'Strategia', tone: 'plum' }], due: '3 ott', assignees: ['Luciano Castro'], tabIndex: -1 }),
          h(KanbanCard, { title: 'Raccogliere testimonianze', labels: [{ text: 'Marketing', tone: 'sky' }], comments: 2, tabIndex: -1 })),
        h('div', { className: 'zr-hero-lane' }, h('div', { className: 'zr-hero-lane-t' }, 'In corso'),
          h(KanbanCard, { title: 'Scaletta del modulo 2', cover: 'citrus', labels: [{ text: 'Contenuti', tone: 'citrus' }], checklist: { done: 3, total: 5 }, assignees: ['Giulia Bianchi', 'Marco Neri'], tabIndex: -1 })),
        h('div', { className: 'zr-hero-lane' }, h('div', { className: 'zr-hero-lane-t' }, 'Fatto'),
          h(KanbanCard, { title: 'Titolo del corso', checklist: { done: 2, total: 2 }, tabIndex: -1 }))));
  }

  function Hero(p) {
    return h('section', { className: 'zr-hero' },
      h('div', { className: 'zr-site-wrap zr-hero-grid' },
        h('div', { className: 'zr-hero-copy' },
          h('span', { className: 'zr-hero-kicker' }, p.kicker || 'Gratis, senza limiti per i progetti personali'),
          h('h1', { className: 'zr-hero-title' }, p.title || 'Tutto il tuo lavoro, in un posto.'),
          h('p', { className: 'zr-hero-sub' }, p.subtitle || 'Project management, CRM, report, automazioni e contenuti AI in un’unica suite semplice. Inizia con le board Kanban: pronte in un minuto.'),
          h('div', { className: 'zr-hero-actions' },
            h('a', { href: p.signupHref || '#', className: 'zr-btn zr-btn-primary zr-btn-lg' }, p.cta || 'Crea il tuo spazio gratis', h(Icon, { name: 'arrow', size: 18 })),
            h('a', { href: p.secondaryHref || '#come-funziona', className: 'zr-btn zr-btn-secondary zr-btn-lg' }, p.secondaryCta || 'Come funziona')),
          h('p', { className: 'zr-hero-note' }, p.note || 'Nessuna carta di credito · Nessun limite di board')),
        p.visual || h(HeroPreview)));
  }

  function SectionHeading(p) {
    return h('div', { className: cx('zr-sec-head', p.align === 'center' && 'is-center') },
      p.overline ? h('span', { className: 'zr-overline' }, p.overline) : null,
      h('h2', { className: 'zr-sec-title' }, p.title),
      p.subtitle ? h('p', { className: 'zr-sec-sub' }, p.subtitle) : null);
  }

  function StepList(p) {
    var steps = p.steps || [
      { title: 'Iscriviti', text: 'Email o Google, nessuna carta. Il tuo spazio di lavoro è pronto subito.', icon: 'users' },
      { title: 'Crea una cartella', text: 'Una per progetto o area: lavoro, clienti, casa, studio.', icon: 'folder' },
      { title: 'Organizza la board', text: 'Liste, schede, scadenze e persone. Trascina e il lavoro avanza.', icon: 'board' }
    ];
    return h('ol', { className: 'zr-steps' }, steps.map(function (s, i) {
      return h('li', { key: i, className: 'zr-step' },
        h('span', { className: 'zr-step-n' }, String(i + 1)),
        h('h3', null, s.title),
        h('p', null, s.text));
    }));
  }

  function AudienceGrid(p) {
    var items = p.items || [
      { title: 'Progetti personali', text: 'Casa, viaggi, studio: gratis e senza limiti.' },
      { title: 'Freelance', text: 'Clienti, consegne e scadenze sotto controllo.' },
      { title: 'Formazione', text: 'Corsi, docenti e calendari di lancio.' },
      { title: 'Agenzie', text: 'Una board per cliente, tutte in una cartella.' },
      { title: 'Associazioni', text: 'Volontari ed eventi coordinati senza fatica.' },
      { title: 'Studi professionali', text: 'Pratiche e adempimenti visibili a tutto lo studio.' }
    ];
    return h('ul', { className: 'zr-audience' }, items.map(function (a, i) {
      return h('li', { key: i }, h('h3', null, a.title), h('p', null, a.text));
    }));
  }

  function PricingCard(p) {
    var soon = p.status === 'soon';
    return h('article', { className: cx('zr-price', p.featured && 'is-featured', soon && 'is-soon') },
      h('header', null,
        h('div', { className: 'zr-price-top' }, h('h3', null, p.name), soon ? h(Label, null, 'In arrivo') : (p.badge ? h(Label, { tone: 'pine' }, p.badge) : null)),
        h('p', { className: 'zr-price-desc' }, p.description)),
      h('div', { className: 'zr-price-amount' }, h('strong', null, p.price), p.period ? h('span', null, p.period) : null),
      h('ul', { className: 'zr-price-list' }, (p.features || []).map(function (f, i) {
        return h('li', { key: i }, h(Icon, { name: 'checklist', size: 16 }), h('span', null, f));
      })),
      soon ? h('button', { type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-md', disabled: true }, p.cta || 'Disponibile a breve')
        : h('a', { href: p.href || '#', className: cx('zr-btn', 'zr-btn-md', p.featured ? 'zr-btn-primary' : 'zr-btn-secondary') }, p.cta || 'Inizia gratis'));
  }

  function FAQ(p) {
    var items = p.items || [
      { q: 'Zeiras è davvero gratis?', a: 'Sì. Per i progetti personali puoi usare Zeiras senza costi e senza limiti di board, liste o schede.' },
      { q: 'Serve una carta di credito per iscriversi?', a: 'No. Basta un indirizzo email o un account Google.' },
      { q: 'Quali prodotti sono disponibili oggi?', a: 'Project Management con board Kanban. CRM, Report, Automazioni e Contenuti AI sono in arrivo e si attiveranno nello stesso spazio di lavoro.' },
      { q: 'Posso invitare altre persone?', a: 'Sì, puoi condividere una board con chi vuoi e assegnare le schede ai membri.' },
      { q: 'Posso usarlo per la mia azienda?', a: 'Zeiras nasce per essere adattato a settori diversi. Scrivici per conoscere le versioni dedicate.' }
    ];
    return h('div', { className: 'zr-faq' }, items.map(function (it, i) {
      return h('details', { key: i, className: 'zr-faq-item', open: i === 0 ? true : undefined },
        h('summary', null, h('span', null, it.q), h(Icon, { name: 'plus', size: 18 })),
        h('p', null, it.a));
    }));
  }

  function CtaBand(p) {
    return h('section', { className: 'zr-cta-band' },
      h('div', { className: 'zr-site-wrap zr-cta-inner' },
        h('div', null,
          h('h2', null, p.title || 'Inizia oggi. È gratis.'),
          h('p', null, p.subtitle || 'Crea il tuo spazio in un minuto e porta ordine nei tuoi progetti.')),
        h('a', { href: p.href || '#', className: 'zr-btn zr-btn-lg zr-btn-onpine' }, p.cta || 'Crea il tuo spazio gratis', h(Icon, { name: 'arrow', size: 18 }))));
  }

  var PUBLISHER = {
    name: 'Castro & Partners', legalForm: 'S.r.l.', address: 'Via Margaritone 30, 52100 Arezzo (AR), Italia', vat: '02453920510', taxCode: null,
    rea: 'AR-215964', capital: '40.000 €', pec: 'castroandpartners@pec.it', email: 'contatti@castroandpartners.com', phone: '+39 0575 138 9257'
  };
  function SiteFooter(p) {
    var co = Object.assign({}, PUBLISHER, p.company || {});
    var cols = p.columns || [
      { title: 'Prodotto', links: ['Project Management', 'CRM', 'Report', 'Automazioni', 'Contenuti AI', 'Prezzi'] },
      { title: 'Risorse', links: ['Guida introduttiva', 'Modelli di board', 'Novità', 'Stato del servizio'] },
      { title: 'Azienda', links: ['Chi siamo', 'Contatti', 'Lavora con noi', 'Stampa'] }
    ];
    var legalLinks = p.legalLinks || [
      { label: 'Privacy policy', href: '#privacy' }, { label: 'Cookie policy', href: '#cookie' },
      { label: 'Preferenze cookie', onClick: p.onCookiePreferences }, { label: 'Termini di servizio', href: '#termini' },
      { label: 'Note legali', href: '#note-legali' }, { label: 'Accessibilità', href: '#accessibilita' }
    ];
    function val(v, label) { return v ? v : h('span', { className: 'zr-foot-missing', title: 'Dato da inserire' }, '[' + label + ']'); }
    var fullName = co.legalForm ? co.name + ' ' + co.legalForm : co.name;
    var items = [
      ['Sede legale', val(co.address, 'indirizzo sede legale')],
      [co.taxCode ? 'P. IVA' : 'P. IVA e C.F.', val(co.vat, 'partita IVA')],
      ['C.F.', co.taxCode || null],
      ['REA', val(co.rea, 'CCIAA e n. REA')],
      ['Capitale sociale', co.capital ? co.capital + ' i.v.' : val(null, 'capitale sociale i.v.')],
      ['PEC', co.pec ? h('a', { href: 'mailto:' + co.pec }, co.pec) : val(null, 'indirizzo PEC')],
      ['Email', co.email ? h('a', { href: 'mailto:' + co.email }, co.email) : null],
      ['Tel.', co.phone || null]
    ].filter(function (x) { return x[1] != null; });
    return h('footer', { className: 'zr-site-foot' },
      h('div', { className: 'zr-site-wrap zr-foot-grid' },
        h('div', { className: 'zr-foot-brand' },
          h(Logo, { size: 24 }),
          h('p', null, p.tagline || 'La suite semplice e gratuita per organizzare il tuo lavoro.'),
          h('p', { className: 'zr-foot-by' }, 'Un prodotto di ', h('strong', null, co.name))),
        cols.map(function (c) {
          return h('nav', { key: c.title, className: 'zr-foot-col', 'aria-label': c.title },
            h('h3', null, c.title),
            c.links.map(function (l) { var t = typeof l === 'string' ? l : l.label; return h('a', { key: t, href: (l && l.href) || '#' }, t); }));
        })),
      h('div', { className: 'zr-site-wrap zr-foot-company' },
        h('p', { className: 'zr-foot-company-line' },
          h('strong', null, fullName),
          items.map(function (x) { return h('span', { key: x[0] }, x[0] + ': ', x[1]); }))),
      h('div', { className: 'zr-site-wrap zr-foot-legal' },
        h('span', null, p.legal || '© ' + new Date().getFullYear() + ' ' + fullName + (/\.$/.test(fullName) ? '' : '.') + ' Tutti i diritti riservati.'),
        h('nav', { className: 'zr-foot-legal-links', 'aria-label': 'Informazioni legali' },
          legalLinks.map(function (l) {
            return l.href ? h('a', { key: l.label, href: l.href }, l.label)
              : h('button', { key: l.label, type: 'button', onClick: l.onClick }, l.label);
          }))));
  }

  function LandingPage(p) {
    var products = p.products || [
      { id: 'pm', name: 'Project Management', icon: 'board', tone: 'pine', description: 'Board Kanban in cartelle: attività, scadenze, checklist e persone.', meta: 'Disponibile ora', cta: 'Prova gratis' },
      { id: 'crm', name: 'CRM', icon: 'users', tone: 'sky', status: 'soon', description: 'Contatti, aziende e trattative in una pipeline semplice.' },
      { id: 'reports', name: 'Report', icon: 'chart', tone: 'citrus', status: 'soon', description: 'Dashboard di marketing e vendite, aggiornate da sole.' },
      { id: 'automations', name: 'Automazioni', icon: 'bolt', tone: 'plum', status: 'soon', description: 'Email, attività e avvisi che partono da soli.' },
      { id: 'content', name: 'Contenuti', icon: 'sparkle', tone: 'coral', status: 'soon', description: 'Post, email e articoli generati con l’AI.' }
    ];
    var plans = p.plans || [
      { name: 'Personale', badge: 'Per sempre', featured: true, price: '0 €', period: '/ mese', description: 'Per i tuoi progetti personali.', features: ['Board, liste e schede illimitate', 'Cartelle illimitate', 'Condivisione con altre persone', 'Tutti i prodotti al lancio'], cta: 'Inizia gratis' },
      { name: 'Team', status: 'soon', price: '—', description: 'Per aziende e organizzazioni, anche in versione verticale.', features: ['Spazi di lavoro per il team', 'Ruoli e permessi', 'Supporto dedicato'] }
    ];
    return h('div', { className: 'zr-site' },
      h(SiteHeader, { signupHref: p.signupHref, loginHref: p.loginHref }),
      h('main', null,
        h(Hero, { signupHref: p.signupHref }),
        h('section', { id: 'prodotti', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'La suite', title: 'Un solo spazio, tutti gli strumenti', subtitle: 'Inizi con il Project Management. CRM, Report, Automazioni e Contenuti arrivano nello stesso posto, già collegati.' }),
          h('div', { className: 'zr-grid-3' }, products.map(function (x) { return h(ProductTile, Object.assign({ key: x.id }, x, { href: x.status === 'soon' ? undefined : (p.signupHref || '#') })); })))),
        h('section', { id: 'come-funziona', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Come funziona', title: 'Operativo in tre passi' }),
          h(StepList, null))),
        h('section', { id: 'per-chi', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Per chi è', title: 'Pensata per chiunque, adattabile a ogni settore' }),
          h(AudienceGrid, null))),
        h('section', { id: 'prezzi', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Prezzi', title: 'Gratis, davvero', subtitle: 'Nessuna prova a tempo, nessuna carta di credito.', align: 'center' }),
          h('div', { className: 'zr-prices' }, plans.map(function (x) { return h(PricingCard, Object.assign({ key: x.name, href: p.signupHref }, x)); })))),
        h('section', { id: 'faq', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap zr-faq-wrap' },
          h(SectionHeading, { overline: 'Domande frequenti', title: 'Tutto quello che vuoi sapere' }),
          h(FAQ, null))),
        h(CtaBand, { href: p.signupHref })),
      h(SiteFooter, null));
  }

  /* =====================  SAAS KIT  ===================== */
  var useEffect = React.useEffect;
  var NF = new Intl.NumberFormat('it-IT');
  var EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function fmtNum(v) { return NF.format(v); }
  function fmtEur(v) { return EUR.format(v); }
  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }

  /* ---------- Form ---------- */
  function Field(p) {
    var id = useId('fld');
    var as = p.as || (p.options ? 'select' : 'input');
    var rest = omit(p, ['label', 'hint', 'error', 'as', 'options', 'className', 'icon', 'children', 'required']);
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var control;
    if (p.children) control = p.children;
    else if (as === 'select') control = h('div', { className: 'zr-select' }, h('select', Object.assign({ id: id, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest),
      p.options.map(function (o) { var v = typeof o === 'string' ? o : o.value; return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label); })), h(Icon, { name: 'chevronDown', size: 16 }));
    else if (as === 'textarea') control = h('textarea', Object.assign({ id: id, rows: 4, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest));
    else control = h('div', { className: cx('zr-input', p.icon && 'has-icon') }, p.icon ? h(Icon, { name: p.icon, size: 16 }) : null,
      h('input', Object.assign({ id: id, type: 'text', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest)));
    return h('div', { className: cx('zr-field', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      control,
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

  function Checkbox(p) {
    var rest = omit(p, ['label', 'className', 'indeterminate']);
    var ref = useRef(null);
    useEffect(function () { if (ref.current) ref.current.indeterminate = !!p.indeterminate; });
    return h('label', { className: cx('zr-check', p.className) },
      h('input', Object.assign({ type: 'checkbox', ref: ref }, rest)),
      h('span', { className: 'zr-check-box', 'aria-hidden': true }, h(Icon, { name: p.indeterminate ? 'close' : 'check', size: 14 })),
      p.label ? h('span', null, p.label) : null);
  }

  function Switch(p) {
    var ctrl = p.checked !== undefined;
    var st = useState(!!p.defaultChecked), on = ctrl ? p.checked : st[0];
    return h('button', { type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': p['aria-label'] || p.label, disabled: p.disabled, className: cx('zr-switch', on && 'is-on', p.className),
      onClick: function () { if (!ctrl) st[1](!on); if (p.onChange) p.onChange(!on); } },
      h('span', { className: 'zr-switch-track', 'aria-hidden': true }, h('span', { className: 'zr-switch-thumb' })),
      p.label ? h('span', { className: 'zr-switch-label' }, p.label) : null);
  }

  function Tabs(p) {
    var items = p.items || [];
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue || (items[0] && (items[0].value || items[0]))), val = ctrl ? p.value : st[0];
    return h('div', { className: cx('zr-seg', p.variant === 'underline' && 'is-underline', p.size === 'sm' && 'is-sm', p.className), role: 'tablist', 'aria-label': p['aria-label'] },
      items.map(function (it) {
        var v = typeof it === 'string' ? it : it.value, l = typeof it === 'string' ? it : it.label;
        return h('button', { key: v, type: 'button', role: 'tab', 'aria-selected': v === val, className: cx('zr-seg-item', v === val && 'is-active'),
          onClick: function () { if (!ctrl) st[1](v); if (p.onChange) p.onChange(v); } }, it.icon ? h(Icon, { name: it.icon, size: 16 }) : null, l, it.count != null ? h('span', { className: 'zr-seg-count' }, it.count) : null);
      }));
  }

  /* ---------- Feedback ---------- */
  var TONE_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'xCircle' };
  function Alert(p) {
    var tone = p.tone || 'info';
    return h('div', { className: cx('zr-alert', 'zr-alert-' + tone, p.className), role: tone === 'danger' ? 'alert' : 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 20 }),
      h('div', { className: 'zr-alert-body' }, p.title ? h('strong', null, p.title) : null, p.children ? h('div', null, p.children) : null),
      p.action || null,
      p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': 'Chiudi', onClick: p.onClose }) : null);
  }

  function Toast(p) {
    var tone = p.tone || 'success';
    return h('div', { className: cx('zr-toast', 'zr-toast-' + tone), role: 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 18 }),
      h('span', { className: 'zr-toast-text' }, p.children),
      p.actionLabel ? h('button', { type: 'button', className: 'zr-toast-action', onClick: p.onAction }, p.actionLabel) : null,
      p.onClose ? h('button', { type: 'button', className: 'zr-toast-close', 'aria-label': 'Chiudi', onClick: p.onClose }, h(Icon, { name: 'close', size: 16 })) : null);
  }

  function Dialog(p) {
    var id = useId('dlg');
    useEffect(function () {
      if (!p.open) return;
      function k(e) { if (e.key === 'Escape' && p.onClose) p.onClose(); }
      document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); };
    }, [p.open]);
    if (!p.open) return null;
    return h('div', { className: cx('zr-scrim', p.inline && 'is-inline'), onMouseDown: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { className: cx('zr-dialog', p.size === 'lg' && 'is-lg'), role: 'dialog', 'aria-modal': true, 'aria-labelledby': id },
        h('header', { className: 'zr-dialog-head' }, h('h2', { id: id }, p.title), p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': 'Chiudi', onClick: p.onClose }) : null),
        p.description ? h('p', { className: 'zr-dialog-desc' }, p.description) : null,
        h('div', { className: 'zr-dialog-body' }, p.children),
        p.footer ? h('footer', { className: 'zr-dialog-foot' }, p.footer) : null));
  }

  function EmptyState(p) {
    return h('div', { className: cx('zr-empty', p.compact && 'is-compact') },
      h('span', { className: cx('zr-iconbox', 'zr-label-' + (p.tone || 'pine')) }, h(Icon, { name: p.icon || 'folder', size: 22 })),
      h('h3', null, p.title),
      p.text ? h('p', null, p.text) : null,
      p.action || null);
  }

  function Progress(p) {
    var pct = Math.max(0, Math.min(100, Math.round((p.value / (p.max || 100)) * 100)));
    var tone = p.tone || (pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'pine');
    return h('div', { className: 'zr-progress' },
      p.label ? h('div', { className: 'zr-progress-top' }, h('span', null, p.label), h('span', null, p.valueLabel || pct + '%')) : null,
      h('div', { className: 'zr-progress-track', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.label },
        h('div', { className: 'zr-progress-bar zr-bg-' + tone, style: { width: pct + '%' } })));
  }

  function Skeleton(p) {
    var lines = p.lines || 3;
    return h('div', { className: 'zr-skel', 'aria-hidden': true }, Array.from({ length: lines }).map(function (_, i) {
      return h('span', { key: i, style: { width: i === lines - 1 ? '60%' : '100%' } });
    }));
  }

  function PageHeader(p) {
    return h('div', { className: 'zr-page-head' },
      h('div', { className: 'zr-page-head-text' },
        p.overline ? h('span', { className: 'zr-overline' }, p.overline) : null,
        h('h1', null, p.title, p.count != null ? h('span', { className: 'zr-count zr-page-count' }, fmtNum(p.count)) : null),
        p.subtitle ? h('p', null, p.subtitle) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

  /* ---------- Data ---------- */
  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var so = useState(p.defaultSort || null), sort = so[0], setSort = so[1];
    var se = useState([]), sel = se[0], setSel = se[1];
    var pg = useState(0), page = pg[0], setPage = pg[1];
    var size = p.pageSize || 8;
    var sorted = rows.slice();
    if (sort) {
      var c = cols.find(function (x) { return x.key === sort.key; });
      var get = (c && c.sortValue) || function (r) { return r[sort.key]; };
      sorted.sort(function (a, b) { var x = get(a), y = get(b); var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'it'); return sort.dir === 'asc' ? r : -r; });
    }
    var pages = Math.max(1, Math.ceil(sorted.length / size));
    var shown = sorted.slice(page * size, page * size + size);
    var rid = function (r, i) { return r.id != null ? r.id : i; };
    var allOn = shown.length > 0 && shown.every(function (r, i) { return sel.indexOf(rid(r, i)) >= 0; });
    function toggle(id) { var n = sel.indexOf(id) >= 0 ? sel.filter(function (x) { return x !== id; }) : sel.concat([id]); setSel(n); if (p.onSelect) p.onSelect(n); }
    return h('div', { className: 'zr-table-wrap' },
      p.selectable && sel.length ? h('div', { className: 'zr-bulk' }, h('strong', null, sel.length + ' selezionati'), p.bulkActions || null,
        h(Button, { variant: 'ghost', size: 'sm', onClick: function () { setSel([]); } }, 'Deseleziona')) : null,
      h('div', { className: 'zr-table-scroll' },
        h('table', { className: 'zr-table' },
          h('thead', null, h('tr', null,
            p.selectable ? h('th', { className: 'zr-td-check' }, h(Checkbox, { 'aria-label': 'Seleziona tutti', checked: allOn, onChange: function () { var ids = shown.map(rid); setSel(allOn ? sel.filter(function (x) { return ids.indexOf(x) < 0; }) : Array.from(new Set(sel.concat(ids)))); } })) : null,
            cols.map(function (c) {
              var active = sort && sort.key === c.key;
              return h('th', { key: c.key, className: cx(c.align === 'right' && 'is-right'), style: c.width ? { width: c.width } : undefined, 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined },
                c.sortable === false ? c.label : h('button', { type: 'button', className: cx('zr-th-sort', active && 'is-active'), onClick: function () { setSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' }); } }, c.label, h(Icon, { name: active ? (sort.dir === 'asc' ? 'trendUp' : 'chevronDown') : 'sort', size: 14 })));
            }))),
          h('tbody', null, shown.length ? shown.map(function (r, i) {
            var id = rid(r, page * size + i), on = sel.indexOf(id) >= 0;
            return h('tr', { key: id, className: cx(on && 'is-selected', p.onRowClick && 'is-clickable'), onClick: p.onRowClick ? function () { p.onRowClick(r); } : undefined },
              p.selectable ? h('td', { className: 'zr-td-check', onClick: function (e) { e.stopPropagation(); } }, h(Checkbox, { 'aria-label': 'Seleziona riga', checked: on, onChange: function () { toggle(id); } })) : null,
              cols.map(function (c) { return h('td', { key: c.key, 'data-label': typeof c.label === 'string' ? c.label : undefined, className: cx(c.align === 'right' && 'is-right') }, c.render ? c.render(r) : r[c.key]); }));
          }) : h('tr', null, h('td', { colSpan: cols.length + (p.selectable ? 1 : 0) }, p.empty || h(EmptyState, { compact: true, icon: 'search', title: 'Nessun risultato', text: 'Prova a cambiare i filtri.' })))))),
      pages > 1 ? h('div', { className: 'zr-pager' },
        h('span', null, (page * size + 1) + '–' + Math.min(sorted.length, page * size + size) + ' di ' + fmtNum(sorted.length)),
        h('div', null,
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevronLeft', 'aria-label': 'Pagina precedente', disabled: page === 0, onClick: function () { setPage(page - 1); } }),
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevron', 'aria-label': 'Pagina successiva', disabled: page >= pages - 1, onClick: function () { setPage(page + 1); } }))) : null);
  }

  function FilterBar(p) {
    return h('div', { className: 'zr-filterbar' },
      p.search !== false ? h('label', { className: 'zr-input has-icon zr-filter-search' }, h(Icon, { name: 'search', size: 16 }),
        h('input', { type: 'search', placeholder: p.searchPlaceholder || 'Cerca…', 'aria-label': 'Cerca', value: p.query, onChange: p.onQuery ? function (e) { p.onQuery(e.target.value); } : undefined })) : null,
      p.children,
      p.actions ? h('div', { className: 'zr-filter-actions' }, p.actions) : null);
  }

  /* ---------- Charts ---------- */
  function niceMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), n = v / e; var st = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]; for (var i = 0; i < st.length; i++) if (n <= st[i]) return st[i] * e; return 10 * e; }
  function compact(v) { return Math.abs(v) >= 1000 ? NF.format(Math.round(v / 100) / 10) + 'k' : NF.format(v); }
  function useWidth() {
    var ref = useRef(null), st = useState(560);
    useEffect(function () {
      if (!ref.current || !window.ResizeObserver) return;
      var ro = new ResizeObserver(function (en) { st[1](Math.max(200, Math.floor(en[0].contentRect.width))); });
      ro.observe(ref.current); return function () { ro.disconnect(); };
    }, []);
    return [ref, st[0]];
  }
  function Legend(p) {
    return h('ul', { className: 'zr-legend' }, p.items.map(function (it, i) {
      return h('li', { key: it.name }, h('span', { className: 'zr-swatch zr-bg-chart-' + (it.color || i + 1) }), it.name, it.value != null ? h('strong', null, it.value) : null);
    }));
  }
  function ChartTooltip(p) {
    if (!p.data) return null;
    return h('div', { className: 'zr-tip', style: { left: p.data.x, top: p.data.y } },
      h('div', { className: 'zr-tip-title' }, p.data.title),
      p.data.rows.map(function (r) { return h('div', { key: r.name, className: 'zr-tip-row' }, h('span', { className: 'zr-swatch zr-bg-chart-' + r.color }), h('span', null, r.name), h('strong', null, r.value)); }));
  }

  var PAD = { l: 44, r: 12, t: 12, b: 28 };
  function Axes(p) {
    var ticks = [0, .25, .5, .75, 1];
    return h('g', null,
      ticks.map(function (t) { var y = PAD.t + p.ih * (1 - t); return h('g', { key: t }, h('line', { x1: PAD.l, x2: PAD.l + p.iw, y1: y, y2: y, className: 'zr-grid' }), h('text', { x: PAD.l - 8, y: y + 4, textAnchor: 'end', className: 'zr-axis' }, p.fmt(p.max * t))); }),
      p.labels.map(function (l, i) { return (p.every && i % p.every) ? null : h('text', { key: i, x: p.xAt(i), y: PAD.t + p.ih + 18, textAnchor: 'middle', className: 'zr-axis' }, l); }));
  }

  function LineChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 240;
    var tt = useState(null), tip = tt[0], setTip = tt[1];
    var series = p.series || [], labels = p.labels || [];
    var fmt = p.format || compact;
    var max = niceMax(Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [1])));
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var xAt = function (i) { return PAD.l + (labels.length > 1 ? iw * i / (labels.length - 1) : iw / 2); };
    var yAt = function (v) { return PAD.t + ih * (1 - v / max); };
    var every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 64)));
    function move(e) {
      var r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left;
      var i = Math.max(0, Math.min(labels.length - 1, Math.round((x - PAD.l) / iw * (labels.length - 1))));
      setTip({ i: i, x: Math.min(xAt(i) + 12, W - 170), y: 8, title: labels[i], rows: series.map(function (s, k) { return { name: s.name, color: s.color || k + 1, value: fmt(s.data[i]) }; }) });
    }
    return h('div', { className: 'zr-chart', ref: ref },
      series.length > 1 ? h(Legend, { items: series }) : null,
      h('div', { className: 'zr-chart-plot' },
        h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Grafico a linee', onMouseMove: move, onMouseLeave: function () { setTip(null); } },
          h(Axes, { iw: iw, ih: ih, max: max, fmt: fmt, labels: labels, xAt: xAt, every: every }),
          tip ? h('line', { x1: xAt(tip.i), x2: xAt(tip.i), y1: PAD.t, y2: PAD.t + ih, className: 'zr-crosshair' }) : null,
          series.map(function (s, k) {
            var c = s.color || k + 1;
            var d = s.data.map(function (v, i) { return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1); }).join(' ');
            return h('g', { key: s.name },
              p.area && k === 0 ? h('path', { d: d + ' L' + xAt(s.data.length - 1) + ' ' + (PAD.t + ih) + ' L' + xAt(0) + ' ' + (PAD.t + ih) + 'Z', className: 'zr-area zr-fill-chart-' + c }) : null,
              h('path', { d: d, className: cx('zr-line', 'zr-stroke-chart-' + c, s.dashed && 'is-dashed') }),
              tip ? h('circle', { cx: xAt(tip.i), cy: yAt(s.data[tip.i]), r: 4.5, className: 'zr-dot zr-fill-chart-' + c }) : null);
          })),
        h(ChartTooltip, { data: tip })));
  }

  function barPath(x, y, w, hgt) { var r = Math.min(4, w / 2, hgt); return 'M' + x + ' ' + (y + hgt) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + hgt) + 'Z'; }

  function BarChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 240;
    var tt = useState(null), tip = tt[0], setTip = tt[1];
    var series = p.series || [], labels = p.labels || [];
    var fmt = p.format || compact;
    var max = niceMax(Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [1])));
    var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var band = iw / labels.length, gw = Math.min(band * 0.7, series.length * 28), bw = (gw - (series.length - 1) * 2) / series.length;
    var xAt = function (i) { return PAD.l + band * i + band / 2; };
    var every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 56)));
    return h('div', { className: 'zr-chart', ref: ref },
      series.length > 1 ? h(Legend, { items: series }) : null,
      h('div', { className: 'zr-chart-plot' },
        h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Grafico a barre', onMouseLeave: function () { setTip(null); } },
          h(Axes, { iw: iw, ih: ih, max: max, fmt: fmt, labels: labels, xAt: xAt, every: every }),
          labels.map(function (l, i) {
            var x0 = xAt(i) - gw / 2;
            return h('g', { key: i, className: cx('zr-bar-group', tip && tip.i !== i && 'is-dim'),
              onMouseEnter: function () { setTip({ i: i, x: Math.min(xAt(i) + gw / 2 + 8, W - 170), y: 8, title: l, rows: series.map(function (s, k) { return { name: s.name, color: s.color || k + 1, value: fmt(s.data[i]) }; }) }); } },
              h('rect', { x: xAt(i) - band / 2, y: PAD.t, width: band, height: ih, fill: 'transparent' }),
              series.map(function (s, k) { var v = s.data[i], bh = Math.max(1, ih * v / max); return h('path', { key: k, d: barPath(x0 + k * (bw + 2), PAD.t + ih - bh, bw, bh), className: 'zr-fill-chart-' + (s.color || k + 1) }); }));
          })),
        h(ChartTooltip, { data: tip })));
  }

  function DonutChart(p) {
    var data = p.data || [], fmt = p.format || fmtNum;
    var total = data.reduce(function (a, d) { return a + d.value; }, 0) || 1;
    var ho = useState(null), hover = ho[0], setHover = ho[1];
    var R = 70, r = 48, C = 80, a0 = -Math.PI / 2, gap = 0.025;
    function arc(s, e) {
      var p1 = [C + R * Math.cos(s), C + R * Math.sin(s)], p2 = [C + R * Math.cos(e), C + R * Math.sin(e)], p3 = [C + r * Math.cos(e), C + r * Math.sin(e)], p4 = [C + r * Math.cos(s), C + r * Math.sin(s)], lg = e - s > Math.PI ? 1 : 0;
      return 'M' + p1 + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + p2 + 'L' + p3 + 'A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + p4 + 'Z';
    }
    var cur = a0;
    var focus = hover != null ? data[hover] : null;
    return h('div', { className: 'zr-donut' },
      h('svg', { width: 160, height: 160, viewBox: '0 0 160 160', role: 'img', 'aria-label': p.ariaLabel || 'Grafico ad anello' },
        data.map(function (d, i) {
          var ang = d.value / total * Math.PI * 2, s = cur + gap / 2, e = cur + ang - gap / 2; cur += ang;
          return h('path', { key: d.label, d: arc(s, Math.max(s + 0.001, e)), className: cx('zr-fill-chart-' + (d.color || (i < 5 ? i + 1 : 'other')), hover != null && hover !== i && 'is-dim'), onMouseEnter: function () { setHover(i); }, onMouseLeave: function () { setHover(null); } });
        }),
        h('text', { x: C, y: C - 2, textAnchor: 'middle', className: 'zr-donut-value' }, focus ? Math.round(focus.value / total * 100) + '%' : (p.centerValue || fmt(total))),
        h('text', { x: C, y: C + 16, textAnchor: 'middle', className: 'zr-axis' }, focus ? focus.label : (p.centerLabel || 'Totale'))),
      h('ul', { className: 'zr-legend is-list' }, data.map(function (d, i) {
        return h('li', { key: d.label, onMouseEnter: function () { setHover(i); }, onMouseLeave: function () { setHover(null); } },
          h('span', { className: 'zr-swatch zr-bg-chart-' + (d.color || (i < 5 ? i + 1 : 'other')) }), h('span', { className: 'zr-legend-name' }, d.label),
          h('strong', null, fmt(d.value)), h('span', { className: 'zr-legend-pct' }, Math.round(d.value / total * 100) + '%'));
      })));
  }

  function Sparkline(p) {
    var d = p.data || [], W = p.width || 96, H = p.height || 32;
    var mn = Math.min.apply(null, d), mx = Math.max.apply(null, d), rg = mx - mn || 1;
    var pts = d.map(function (v, i) { return (i * W / (d.length - 1)).toFixed(1) + ',' + (H - 3 - (v - mn) / rg * (H - 6)).toFixed(1); }).join(' ');
    return h('svg', { width: W, height: H, className: 'zr-spark', 'aria-hidden': true }, h('polyline', { points: pts, className: 'zr-line zr-stroke-chart-' + (p.color || 1) }));
  }

  function StatCard(p) {
    var up = p.delta > 0, good = p.invert ? !up : up;
    return h('div', { className: 'zr-stat' },
      h('div', { className: 'zr-stat-top' }, h('span', { className: 'zr-stat-label' }, p.label), p.icon ? h('span', { className: 'zr-stat-icon' }, h(Icon, { name: p.icon, size: 16 })) : null),
      h('div', { className: 'zr-stat-row' },
        h('strong', { className: 'zr-stat-value' }, p.value),
        p.trend ? h(Sparkline, { data: p.trend }) : null),
      p.delta != null ? h('div', { className: 'zr-stat-foot' },
        h('span', { className: cx('zr-delta', p.delta === 0 ? 'is-flat' : good ? 'is-good' : 'is-bad') }, h(Icon, { name: up ? 'trendUp' : 'trendDown', size: 14 }), (up ? '+' : '') + String(p.delta).replace('.', ',') + '%'),
        h('span', null, p.deltaLabel || 'vs periodo precedente')) : null);
  }

  function ChartCard(p) {
    return h('section', { className: cx('zr-panel', p.className) },
      h('header', { className: 'zr-panel-head' }, h('div', null, h('h2', null, p.title), p.subtitle ? h('p', null, p.subtitle) : null), p.actions ? h('div', { className: 'zr-panel-actions' }, p.actions) : null),
      h('div', { className: 'zr-panel-body' }, p.children));
  }

  /* ---------- CRM ---------- */
  var STATUS_TONE = { Lead: 'sky', Qualificato: 'plum', Cliente: 'pine', Perso: 'neutral', Attiva: 'pine', 'In pausa': 'citrus', Bozza: 'neutral', Errore: 'coral' };
  function StatusLabel(p) { return h(Label, { tone: p.tone || STATUS_TONE[p.status] || 'neutral' }, p.status); }

  function RecordHeader(p) {
    return h('header', { className: 'zr-record' },
      h(Avatar, { name: p.name, size: 'lg' }),
      h('div', { className: 'zr-record-main' },
        h('div', { className: 'zr-record-title' }, h('h1', null, p.name), p.status ? h(StatusLabel, { status: p.status }) : null),
        p.subtitle ? h('p', null, p.subtitle) : null,
        p.meta ? h('ul', { className: 'zr-record-meta' }, p.meta.map(function (m) { return h('li', { key: m.text }, h(Icon, { name: m.icon, size: 14 }), m.href ? h('a', { href: m.href }, m.text) : m.text); })) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

  var ACT_ICON = { email: ['mail', 'sky'], call: ['phone', 'pine'], note: ['edit', 'citrus'], deal: ['euro', 'plum'], task: ['checklist', 'neutral'], automation: ['bolt', 'plum'] };
  function ActivityTimeline(p) {
    return h('ol', { className: 'zr-timeline' }, (p.items || []).map(function (it, i) {
      var ic = ACT_ICON[it.type] || ['info', 'neutral'];
      return h('li', { key: i },
        h('span', { className: cx('zr-iconbox', 'zr-iconbox-xs', 'zr-label-' + ic[1]) }, h(Icon, { name: ic[0], size: 14 })),
        h('div', { className: 'zr-tl-body' },
          h('div', { className: 'zr-tl-head' }, h('strong', null, it.title), h('time', null, it.time)),
          it.text ? h('p', null, it.text) : null,
          it.by ? h('span', { className: 'zr-tl-by' }, it.by) : null));
    }));
  }

  function DescriptionList(p) {
    return h('dl', { className: 'zr-dl' }, (p.items || []).map(function (it) { return h('div', { key: it.label }, h('dt', null, it.label), h('dd', null, it.value)); }));
  }

  function DealCard(p) {
    var rest = omit(p, ['title', 'company', 'companyIcon', 'amount', 'owner', 'probability', 'age', 'ageLabel', 'ageTitle', 'dragging', 'className']);
    var cIcon = p.companyIcon === undefined ? 'building' : p.companyIcon;
    return h('article', Object.assign({ tabIndex: 0 }, rest, { className: cx('zr-card zr-deal', p.dragging && 'is-dragging', p.className) }),
      h('div', { className: 'zr-deal-top' }, p.company ? h('span', { className: 'zr-deal-company' }, cIcon ? h(Icon, { name: cIcon, size: 14 }) : null, p.company) : h('span', null), p.owner ? h(Avatar, { name: p.owner, size: 'sm' }) : null),
      h('h4', { className: 'zr-card-title' }, p.title),
      h('div', { className: 'zr-deal-foot' },
        h('strong', { className: 'zr-deal-amount' }, fmtEur(p.amount)),
        h('span', { className: 'zr-card-meta' }, p.probability != null ? h('span', { className: 'zr-meta' }, h(Icon, { name: 'target', size: 14 }), p.probability + '%') : null,
          p.age ? h('span', { className: cx('zr-meta', p.age > 14 && 'is-overdue'), title: p.ageTitle || 'Giorni in questa fase' }, h(Icon, { name: 'clock', size: 14 }), p.age + ' ' + (p.ageLabel || 'gg')) : null)));
  }

  var SAMPLE_STAGES = [
    { id: 'new', title: 'Nuovo lead', deals: [{ id: 'd1', title: 'Corso Leadership · 12 posti', company: 'Rossi Logistica', amount: 7200, owner: 'Luciano Castro', probability: 10, age: 2 }, { id: 'd2', title: 'Formazione PM interna', company: 'Studio Bianchi', amount: 3400, owner: 'Giulia Bianchi', probability: 10, age: 5 }] },
    { id: 'qual', title: 'Qualificato', deals: [{ id: 'd3', title: 'Certificazione PMP ×4', company: 'Nexa Srl', amount: 9800, owner: 'Marco Neri', probability: 30, age: 9 }] },
    { id: 'prop', title: 'Proposta', deals: [{ id: 'd4', title: 'Percorso manager 2027', company: 'Alfa Costruzioni', amount: 18500, owner: 'Luciano Castro', probability: 55, age: 18 }, { id: 'd5', title: 'Coaching team vendite', company: 'Verdi & Figli', amount: 4200, owner: 'Giulia Bianchi', probability: 50, age: 4 }] },
    { id: 'neg', title: 'Negoziazione', deals: [{ id: 'd6', title: 'Academy aziendale', company: 'Orion Spa', amount: 26000, owner: 'Marco Neri', probability: 75, age: 7 }] },
    { id: 'won', title: 'Vinto', deals: [{ id: 'd7', title: 'Workshop Agile', company: 'Blu Digital', amount: 2900, owner: 'Luciano Castro', probability: 100, age: 1 }] }
  ];
  function DealPipeline(p) {
    var st = useState(function () { return JSON.parse(JSON.stringify(p.stages || SAMPLE_STAGES)); }), stages = st[0], setStages = st[1];
    var dg = useState(null), drag = dg[0], setDrag = dg[1];
    var ov = useState(null), over = ov[0], setOver = ov[1];
    function move(id, to) {
      var deal; var n = stages.map(function (s) { return Object.assign({}, s, { deals: s.deals.filter(function (d) { if (d.id === id) { deal = d; return false; } return true; }) }); });
      if (!deal) return; n = n.map(function (s) { return s.id === to ? Object.assign({}, s, { deals: s.deals.concat([Object.assign({}, deal, { age: 0 })]) }) : s; });
      setStages(n); if (p.onChange) p.onChange(n);
    }
    var L = Object.assign({ overline: 'CRM', title: 'Pipeline vendite', open: 'Aperte', weighted: 'Ponderate', filter: 'Filtra', newDeal: 'Nuova trattativa', total: 'Totale' }, p.labels || {});
    function kindOf(s) { return s.kind || (s.id === 'won' ? 'won' : s.id === 'lost' ? 'lost' : 'open'); }
    var openStages = stages.filter(function (s) { return kindOf(s) === 'open'; });
    var total = openStages.reduce(function (a, s) { return a + s.deals.reduce(function (b, d) { return b + d.amount; }, 0); }, 0);
    var weighted = openStages.reduce(function (a, s) { return a + s.deals.reduce(function (b, d) { return b + d.amount * (d.probability || 0) / 100; }, 0); }, 0);
    return h('div', { className: 'zr-board' },
      h('div', { className: 'zr-board-head zr-board-head-plain' },
        h(PageHeader, { overline: L.overline, title: p.title || L.title, subtitle: L.open + ' ' + fmtEur(total) + ' · ' + L.weighted + ' ' + fmtEur(Math.round(weighted)),
          actions: [h(Button, { key: 'f', variant: 'secondary', size: 'sm', icon: 'filter', onClick: p.onFilter }, L.filter), h(Button, { key: 'n', size: 'sm', icon: 'plus', onClick: p.onNew }, L.newDeal)] })),
      h('div', { className: 'zr-lanes' }, stages.map(function (s) {
        var sum = s.deals.reduce(function (a, d) { return a + d.amount; }, 0);
        return h(KanbanColumn, { key: s.id, title: s.title, count: s.deals.length, isOver: over === s.id && drag, className: kindOf(s) === 'won' ? 'is-won' : undefined,
          onDragOver: function (e) { e.preventDefault(); if (over !== s.id) setOver(s.id); },
          onDrop: function (e) { e.preventDefault(); if (drag) move(drag, s.id); setDrag(null); setOver(null); },
          composer: h('div', { className: 'zr-col-sum' }, h('span', null, L.total), h('strong', null, fmtEur(sum))) },
          s.deals.map(function (d) { return h(DealCard, Object.assign({ key: d.id, companyIcon: p.companyIcon, ageLabel: p.labels && p.labels.days, ageTitle: p.labels && p.labels.daysTitle }, d, { draggable: true, dragging: drag === d.id, onDragStart: function (e) { setDrag(d.id); try { e.dataTransfer.setData('text/plain', d.id); } catch (x) {} }, onDragEnd: function () { setDrag(null); setOver(null); } })); }));
      })));
  }

  var SAMPLE_CONTACTS = [
    ['Anna Ferri', 'anna.ferri@rossilogistica.it', 'Rossi Logistica', 'Lead', 'Luciano Castro', 7200, 'oggi'],
    ['Paolo Greco', 'p.greco@nexa.it', 'Nexa Srl', 'Qualificato', 'Marco Neri', 9800, 'ieri'],
    ['Sara Conti', 'sara@alfacostruzioni.it', 'Alfa Costruzioni', 'Cliente', 'Luciano Castro', 18500, '2 gg fa'],
    ['Luca Moretti', 'luca.moretti@orion.it', 'Orion Spa', 'Qualificato', 'Marco Neri', 26000, '3 gg fa'],
    ['Elena Ricci', 'elena@bludigital.it', 'Blu Digital', 'Cliente', 'Giulia Bianchi', 2900, '5 gg fa'],
    ['Davide Galli', 'd.galli@verdiefigli.it', 'Verdi & Figli', 'Lead', 'Giulia Bianchi', 4200, '1 sett fa'],
    ['Chiara Lombardi', 'chiara@studiobianchi.it', 'Studio Bianchi', 'Lead', 'Luciano Castro', 3400, '2 sett fa'],
    ['Marco Fontana', 'm.fontana@kappa.it', 'Kappa Group', 'Perso', 'Marco Neri', 0, '1 mese fa'],
    ['Giorgia Serra', 'giorgia@lumen.it', 'Lumen', 'Cliente', 'Giulia Bianchi', 5600, '1 mese fa']
  ].map(function (r, i) { return { id: 'ct' + i, name: r[0], email: r[1], company: r[2], status: r[3], owner: r[4], value: r[5], last: r[6] }; });

  function CrmContacts(p) {
    var rows = p.contacts || SAMPLE_CONTACTS;
    var q = useState(''), query = q[0], setQuery = q[1];
    var f = useState('Tutti'), filter = f[0], setFilter = f[1];
    var shown = rows.filter(function (r) { return (filter === 'Tutti' || r.status === filter) && (!query || (r.name + r.company + r.email).toLowerCase().indexOf(query.toLowerCase()) >= 0); });
    var count = function (s) { return rows.filter(function (r) { return r.status === s; }).length; };
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'CRM', title: 'Contatti', count: rows.length, actions: [h(Button, { key: 'i', variant: 'secondary', icon: 'upload' }, 'Importa CSV'), h(Button, { key: 'n', icon: 'plus' }, 'Nuovo contatto')] }),
      h(FilterBar, { query: query, onQuery: setQuery, searchPlaceholder: 'Cerca per nome, azienda, email…', actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'download' }, 'Esporta') },
        h(Tabs, { size: 'sm', value: filter, onChange: setFilter, 'aria-label': 'Stato', items: [{ value: 'Tutti', label: 'Tutti', count: rows.length }, { value: 'Lead', label: 'Lead', count: count('Lead') }, { value: 'Qualificato', label: 'Qualificati', count: count('Qualificato') }, { value: 'Cliente', label: 'Clienti', count: count('Cliente') }] })),
      h(DataTable, { selectable: true, rows: shown, onRowClick: p.onOpen, pageSize: p.pageSize || 8,
        bulkActions: [h(Button, { key: 'e', variant: 'secondary', size: 'sm', icon: 'mail' }, 'Invia email'), h(Button, { key: 't', variant: 'secondary', size: 'sm', icon: 'tag' }, 'Etichetta')],
        columns: [
          { key: 'name', label: 'Nome', render: function (r) { return h('span', { className: 'zr-cell-person' }, h(Avatar, { name: r.name, size: 'md' }), h('span', null, h('strong', null, r.name), h('small', null, r.email))); } },
          { key: 'company', label: 'Azienda' },
          { key: 'status', label: 'Stato', render: function (r) { return h(StatusLabel, { status: r.status }); } },
          { key: 'owner', label: 'Responsabile', render: function (r) { return h('span', { className: 'zr-cell-owner' }, h(Avatar, { name: r.owner, size: 'sm' }), r.owner.split(' ')[0]); } },
          { key: 'value', label: 'Valore', align: 'right', render: function (r) { return r.value ? fmtEur(r.value) : '—'; } },
          { key: 'last', label: 'Ultima attività', sortable: false }
        ] }));
  }

  function ContactDetail(p) {
    var c = p.contact || { name: 'Sara Conti', role: 'Responsabile HR', company: 'Alfa Costruzioni', status: 'Cliente', email: 'sara@alfacostruzioni.it', phone: '+39 055 123 4567', owner: 'Luciano Castro' };
    var tb = useState('note'), tab = tb[0], setTab = tb[1];
    return h('div', { className: 'zr-stack' },
      h(RecordHeader, { name: c.name, status: c.status, subtitle: c.role + ' · ' + c.company,
        meta: [{ icon: 'mail', text: c.email, href: 'mailto:' + c.email }, { icon: 'phone', text: c.phone }, { icon: 'user', text: 'Responsabile: ' + c.owner }],
        actions: [h(Button, { key: 'm', variant: 'secondary', icon: 'mail' }, 'Email'), h(Button, { key: 'c', variant: 'secondary', icon: 'phone' }, 'Chiama'), h(Button, { key: 'd', icon: 'plus' }, 'Trattativa')] }),
      h('div', { className: 'zr-split' },
        h('section', { className: 'zr-panel' },
          h('div', { className: 'zr-panel-head' }, h(Tabs, { variant: 'underline', value: tab, onChange: setTab, items: [{ value: 'note', label: 'Nota', icon: 'edit' }, { value: 'email', label: 'Email', icon: 'mail' }, { value: 'call', label: 'Chiamata', icon: 'phone' }, { value: 'task', label: 'Attività', icon: 'checklist' }] })),
          h('div', { className: 'zr-panel-body zr-stack' },
            h('div', { className: 'zr-composer' }, h('textarea', { rows: 3, placeholder: tab === 'email' ? 'Scrivi un’email a ' + c.name.split(' ')[0] + '…' : tab === 'call' ? 'Esito della chiamata…' : tab === 'task' ? 'Cosa c’è da fare?' : 'Scrivi una nota…', 'aria-label': 'Nuova attività' }),
              h('div', { className: 'zr-composer-row' }, h(Button, { size: 'sm' }, 'Salva'))),
            h(ActivityTimeline, { items: p.activities || [
              { type: 'deal', title: 'Trattativa vinta: Percorso manager 2027', time: 'oggi, 10:24', text: '18.500 € · chiusa da Luciano' },
              { type: 'email', title: 'Email inviata: Proposta aggiornata', time: 'ieri', text: 'Aperta 3 volte · 1 clic sul PDF', by: 'Luciano Castro' },
              { type: 'automation', title: 'Automazione "Benvenuto clienti" avviata', time: 'ieri' },
              { type: 'call', title: 'Chiamata · 12 min', time: '24 set', text: 'Interessati a 2 edizioni nel 2027. Richiamare dopo il budget.', by: 'Luciano Castro' },
              { type: 'note', title: 'Nota', time: '20 set', text: 'Referente decisionale: direttore generale.', by: 'Giulia Bianchi' }
            ] }))),
        h('aside', { className: 'zr-stack' },
          h('section', { className: 'zr-panel' }, h('div', { className: 'zr-panel-head' }, h('h2', null, 'Dettagli')), h('div', { className: 'zr-panel-body' },
            h(DescriptionList, { items: [{ label: 'Azienda', value: c.company }, { label: 'Ruolo', value: c.role }, { label: 'Fonte', value: 'Webinar' }, { label: 'Creato', value: '12 mar 2026' }, { label: 'Etichette', value: h('span', { className: 'zr-card-labels' }, h(Label, { tone: 'sky' }, 'Formazione'), h(Label, { tone: 'plum' }, 'Enterprise')) }] }))),
          h('section', { className: 'zr-panel' }, h('div', { className: 'zr-panel-head' }, h('h2', null, 'Trattative'), h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', 'aria-label': 'Nuova trattativa' })), h('div', { className: 'zr-panel-body zr-stack-sm' },
            h(DealCard, { title: 'Percorso manager 2027', company: c.company, amount: 18500, probability: 100 }),
            h(DealCard, { title: 'Workshop comunicazione', company: c.company, amount: 3200, probability: 40, age: 6 }))))));
  }

  /* ---------- Report ---------- */
  function ReportDashboard(p) {
    var r = useState('30g'), range = r[0], setRange = r[1];
    var weeks = ['4 ago', '11 ago', '18 ago', '25 ago', '1 set', '8 set', '15 set', '22 set'];
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'Report', title: p.title || 'Marketing', subtitle: 'Aggiornato 5 minuti fa', actions: [h(Button, { key: 's', variant: 'secondary', icon: 'share' }, 'Condividi'), h(Button, { key: 'e', variant: 'secondary', icon: 'download' }, 'Esporta PDF')] }),
      h(FilterBar, { search: false, actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'plus' }, 'Aggiungi widget') },
        h(Tabs, { size: 'sm', value: range, onChange: setRange, 'aria-label': 'Periodo', items: [{ value: '7g', label: '7 giorni' }, { value: '30g', label: '30 giorni' }, { value: '90g', label: '90 giorni' }, { value: '12m', label: '12 mesi' }] }),
        h(Field, { 'aria-label': 'Canale', options: ['Tutti i canali', 'Organico', 'Ads', 'Email', 'Social'], className: 'zr-field-inline' })),
      h('div', { className: 'zr-grid-4' },
        h(StatCard, { label: 'Visite al sito', icon: 'eye', value: '24.310', delta: 12.4, trend: [12, 14, 13, 17, 16, 19, 21, 24] }),
        h(StatCard, { label: 'Lead generati', icon: 'users', value: '612', delta: 8.1, trend: [40, 52, 49, 61, 58, 70, 74, 82] }),
        h(StatCard, { label: 'Tasso di conversione', icon: 'target', value: '2,5%', delta: -0.4, trend: [2.9, 2.8, 2.7, 2.8, 2.6, 2.6, 2.5, 2.5] }),
        h(StatCard, { label: 'Costo per lead', icon: 'euro', value: '14 €', delta: -6.2, invert: true, trend: [18, 17, 17, 16, 15, 15, 14, 14] })),
      h('div', { className: 'zr-grid-report' },
        h(ChartCard, { title: 'Lead per canale', subtitle: 'Ultime 8 settimane', actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': 'Opzioni grafico' }) },
          h(LineChart, { labels: weeks, series: [{ name: 'Organico', data: [32, 38, 35, 44, 41, 48, 52, 57] }, { name: 'Ads', data: [20, 26, 24, 22, 29, 33, 31, 36] }, { name: 'Email', data: [12, 14, 18, 15, 17, 19, 23, 21] }] })),
        h(ChartCard, { title: 'Fonti di traffico', subtitle: 'Visite, 30 giorni' },
          h(DonutChart, { data: [{ label: 'Ricerca organica', value: 9820 }, { label: 'Social', value: 5410 }, { label: 'Ads', value: 4630 }, { label: 'Email', value: 2870 }, { label: 'Diretto', value: 1580 }] }))),
      h(ChartCard, { title: 'Lead e lead qualificati per mese' },
        h(BarChart, { height: 220, labels: ['apr', 'mag', 'giu', 'lug', 'ago', 'set'], series: [{ name: 'Lead', data: [420, 480, 455, 390, 360, 612] }, { name: 'Lead qualificati', data: [168, 202, 178, 150, 139, 257] }] })),
      h(ChartCard, { title: 'Campagne' },
        h(DataTable, { defaultSort: { key: 'leads', dir: 'desc' }, rows: [
          { id: 1, name: 'Webinar Leadership', ch: 'Email', spend: 0, leads: 184, conv: 4.1 },
          { id: 2, name: 'Google Ads · PMP', ch: 'Ads', spend: 2400, leads: 156, conv: 2.3 },
          { id: 3, name: 'LinkedIn · Team Leader', ch: 'Social', spend: 1800, leads: 98, conv: 1.9 },
          { id: 4, name: 'Guida gratuita Agile', ch: 'Organico', spend: 0, leads: 174, conv: 3.6 }],
          columns: [{ key: 'name', label: 'Campagna', render: function (r) { return h('strong', null, r.name); } }, { key: 'ch', label: 'Canale' },
            { key: 'spend', label: 'Spesa', align: 'right', render: function (r) { return r.spend ? fmtEur(r.spend) : '—'; } },
            { key: 'leads', label: 'Lead', align: 'right', render: function (r) { return fmtNum(r.leads); } },
            { key: 'cpl', label: 'Costo/lead', align: 'right', sortValue: function (r) { return r.spend / r.leads; }, render: function (r) { return r.spend ? fmtEur(Math.round(r.spend / r.leads)) : '—'; } },
            { key: 'conv', label: 'Conversione', align: 'right', render: function (r) { return String(r.conv).replace('.', ',') + '%'; } }] })));
  }

  /* ---------- Automazioni ---------- */
  var STEP_META = { trigger: ['Quando', 'bolt', 'pine'], condition: ['Se', 'split', 'citrus'], action: ['Allora', 'play', 'sky'], delay: ['Attendi', 'clock', 'neutral'] };
  function AutomationStep(p) {
    var m = STEP_META[p.type] || STEP_META.action;
    return h('div', { className: cx('zr-step-node', 'is-' + p.type, p.selected && 'is-selected'), tabIndex: 0, role: 'button', onClick: p.onClick },
      h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + m[2]) }, h(Icon, { name: p.icon || m[1], size: 18 })),
      h('div', { className: 'zr-step-text' }, h('span', { className: 'zr-overline zr-overline-muted' }, m[0]), h('strong', null, p.title), p.detail ? h('span', null, p.detail) : null),
      p.stats ? h('span', { className: 'zr-step-stats' }, p.stats) : null);
  }

  var SAMPLE_FLOW = [
    { id: 's1', type: 'trigger', title: 'Nuovo contatto da modulo', detail: 'Modulo "Scarica la guida Agile"', icon: 'form', stats: '312 esecuzioni' },
    { id: 's2', type: 'action', title: 'Invia email di benvenuto', detail: 'Modello: Benvenuto + guida PDF', icon: 'mail' },
    { id: 's3', type: 'delay', title: '3 giorni' },
    { id: 's4', type: 'condition', title: 'Ha aperto l’email?', detail: 'Sì → continua · No → reinvia con nuovo oggetto' },
    { id: 's5', type: 'action', title: 'Crea attività per il commerciale', detail: 'Assegna a: responsabile del contatto', icon: 'checklist' },
    { id: 's6', type: 'action', title: 'Sposta in pipeline: Qualificato', icon: 'euro' }
  ];
  function WorkflowBuilder(p) {
    var st = useState(function () { return (p.steps || SAMPLE_FLOW).slice(); }), steps = st[0], setSteps = st[1];
    var se = useState(p.defaultSelected || null), sel = se[0], setSel = se[1];
    var on = useState(p.active !== false), active = on[0], setActive = on[1];
    var seq = useRef(0);
    function insert(i) { seq.current += 1; var n = steps.slice(); n.splice(i + 1, 0, { id: 'x' + seq.current, type: 'action', title: 'Nuova azione', detail: 'Scegli cosa deve succedere' }); setSteps(n); setSel('x' + seq.current); if (p.onChange) p.onChange(n); }
    var current = steps.find(function (s) { return s.id === sel; });
    return h('div', { className: 'zr-flow-wrap' },
      h('div', { className: 'zr-flow-head' },
        h('div', null, h('span', { className: 'zr-overline' }, 'Automazione'), h('h1', { className: 'zr-flow-title' }, p.name || 'Benvenuto nuovi lead')),
        h('div', { className: 'zr-page-actions' },
          h(Switch, { label: active ? 'Attiva' : 'In pausa', checked: active, onChange: setActive }),
          h(Button, { variant: 'secondary', size: 'sm', icon: 'play' }, 'Prova'),
          h(Button, { size: 'sm' }, 'Salva'))),
      h('div', { className: 'zr-flow-body' },
        h('div', { className: 'zr-flow-canvas' },
          h('ol', { className: 'zr-flow' }, steps.map(function (s, i) {
            return h('li', { key: s.id },
              h(AutomationStep, Object.assign({}, s, { selected: sel === s.id, onClick: function () { setSel(s.id); } })),
              h('div', { className: 'zr-flow-link' }, h('button', { type: 'button', className: 'zr-flow-add', 'aria-label': 'Aggiungi passo dopo ' + s.title, onClick: function () { insert(i); } }, h(Icon, { name: 'plus', size: 14 }))));
          }), h('li', { className: 'zr-flow-end' }, h('span', null, 'Fine')))),
        current ? h('aside', { className: 'zr-flow-panel' },
          h('header', { className: 'zr-panel-head' }, h('h2', null, 'Configura passo'), h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': 'Chiudi', onClick: function () { setSel(null); } })),
          h('div', { className: 'zr-panel-body zr-stack' },
            h(Field, { label: 'Tipo di passo', options: [{ value: 'action', label: 'Azione' }, { value: 'condition', label: 'Condizione' }, { value: 'delay', label: 'Attesa' }], value: current.type, onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { type: e.target.value }) : x; })); } }),
            h(Field, { label: 'Titolo', value: current.title, onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { title: e.target.value }) : x; })); } }),
            h(Field, { label: 'Dettagli', as: 'textarea', rows: 3, value: current.detail || '', onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { detail: e.target.value }) : x; })); } }),
            current.type !== 'trigger' ? h(Button, { variant: 'ghost', icon: 'trash', className: 'zr-danger-text', onClick: function () { setSteps(steps.filter(function (x) { return x.id !== current.id; })); setSel(null); } }, 'Elimina passo') : null)) : null));
  }

  function AutomationList(p) {
    var rows = p.automations || [
      { id: 1, name: 'Benvenuto nuovi lead', trigger: 'Nuovo contatto da modulo', runs: 312, last: '12 min fa', status: 'Attiva' },
      { id: 2, name: 'Promemoria scadenze board', trigger: 'Scheda in scadenza domani', runs: 1204, last: '1 h fa', status: 'Attiva' },
      { id: 3, name: 'Trattativa ferma da 14 giorni', trigger: 'Trattativa senza attività', runs: 48, last: 'ieri', status: 'Attiva' },
      { id: 4, name: 'Newsletter mensile', trigger: 'Ogni primo lunedì del mese', runs: 9, last: '1 set', status: 'In pausa' },
      { id: 5, name: 'Sincronizza fatture', trigger: 'Trattativa vinta', runs: 3, last: '2 gg fa', status: 'Errore' }
    ];
    var st = useState(function () { var o = {}; rows.forEach(function (r) { o[r.id] = r.status === 'Attiva'; }); return o; }), on = st[0], setOn = st[1];
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'Automazioni', title: 'Le tue automazioni', count: rows.length, actions: [h(Button, { key: 't', variant: 'secondary', icon: 'copy' }, 'Da modello'), h(Button, { key: 'n', icon: 'plus' }, 'Nuova automazione')] }),
      rows.some(function (r) { return r.status === 'Errore'; }) ? h(Alert, { tone: 'danger', title: '1 automazione si è fermata per un errore', action: h(Button, { variant: 'secondary', size: 'sm' }, 'Vedi dettagli') }, '"Sincronizza fatture" non riesce a collegarsi al servizio esterno.') : null,
      h(DataTable, { rows: rows, onRowClick: p.onOpen, columns: [
        { key: 'name', label: 'Nome', render: function (r) { return h('span', { className: 'zr-cell-person' }, h('span', { className: 'zr-iconbox zr-iconbox-xs zr-label-plum' }, h(Icon, { name: 'bolt', size: 14 })), h('span', null, h('strong', null, r.name), h('small', null, 'Quando: ' + r.trigger))); } },
        { key: 'status', label: 'Stato', render: function (r) { var s = r.status === 'Errore' ? 'Errore' : on[r.id] ? 'Attiva' : 'In pausa'; return h(StatusLabel, { status: s }); } },
        { key: 'runs', label: 'Esecuzioni', align: 'right', render: function (r) { return fmtNum(r.runs); } },
        { key: 'last', label: 'Ultima', sortable: false },
        { key: 'toggle', label: '', sortable: false, align: 'right', render: function (r) { return h('span', { onClick: function (e) { e.stopPropagation(); } }, h(Switch, { 'aria-label': 'Attiva ' + r.name, checked: !!on[r.id], disabled: r.status === 'Errore', onChange: function (v) { var n = Object.assign({}, on); n[r.id] = v; setOn(n); } })); } }
      ] }));
  }

  /* ---------- Contenuti (AI) ---------- */
  var CONTENT_TYPES = [{ value: 'linkedin', label: 'Post LinkedIn' }, { value: 'email', label: 'Email newsletter' }, { value: 'blog', label: 'Articolo blog' }, { value: 'ads', label: 'Annuncio pubblicitario' }, { value: 'product', label: 'Descrizione prodotto' }];
  function demoGenerate(o) {
    var t = o.topic || 'il nostro nuovo corso';
    var open = { Professionale: 'Parliamo di ', Amichevole: 'Ti è mai capitato di pensare a ', Ispirazionale: 'Ogni grande risultato comincia da ', Diretto: 'In breve: ' }[o.tone] || '';
    var base = [
      open + t + '. Abbiamo raccolto quello che serve davvero per partire con il piede giusto, senza giri di parole.',
      open + t + '? Tre idee pratiche che puoi applicare già da domani, anche se hai poco tempo.',
      open + t + ': cosa abbiamo imparato lavorando con decine di team, e cosa rifaremmo diversamente.'
    ];
    var extra = o.length === 'Lunga' ? ' Nei prossimi paragrafi vediamo esempi concreti, gli errori più comuni e una checklist da usare subito. Alla fine trovi le risorse per approfondire.' : o.length === 'Media' ? ' Ecco da dove cominciare, passo dopo passo.' : '';
    return base.map(function (b, i) { return { id: Date.now() + i, text: b + extra }; });
  }
  function ContentStudio(p) {
    var f = useState({ type: 'linkedin', topic: 'come organizzare un team con la board Kanban', audience: 'Manager di PMI', tone: 'Professionale', length: 'Media' }), form = f[0], setForm = f[1];
    var o = useState(null), out = o[0], setOut = o[1];
    var l = useState(false), loading = l[0], setLoading = l[1];
    var c = useState(null), copied = c[0], setCopied = c[1];
    function set(k, v) { var n = Object.assign({}, form); n[k] = v; setForm(n); }
    function run() {
      setLoading(true); setOut(null);
      var res = p.onGenerate ? p.onGenerate(form) : new Promise(function (r) { setTimeout(function () { r(demoGenerate(form)); }, 900); });
      Promise.resolve(res).then(function (v) { setOut(v); setLoading(false); });
    }
    useEffect(function () { if (p.autoGenerate) run(); }, []);
    function copy(it) { try { navigator.clipboard.writeText(it.text); } catch (e) {} setCopied(it.id); setTimeout(function () { setCopied(null); }, 1600); }
    var used = p.used != null ? p.used : 18, limit = p.limit || 100;
    return h('div', { className: 'zr-studio' },
      h('section', { className: 'zr-panel zr-studio-form' },
        h('header', { className: 'zr-panel-head' }, h('div', null, h('span', { className: 'zr-overline' }, 'Contenuti'), h('h2', null, 'Nuovo contenuto'))),
        h('div', { className: 'zr-panel-body zr-stack' },
          h(Field, { label: 'Tipo di contenuto', options: CONTENT_TYPES, value: form.type, onChange: function (e) { set('type', e.target.value); } }),
          h(Field, { label: 'Di cosa vuoi parlare?', as: 'textarea', rows: 3, value: form.topic, onChange: function (e) { set('topic', e.target.value); }, hint: 'Una frase basta. Più dettagli dai, più il testo è preciso.' }),
          h(Field, { label: 'A chi ti rivolgi', icon: 'users', value: form.audience, onChange: function (e) { set('audience', e.target.value); } }),
          h('div', { className: 'zr-field' }, h('span', { className: 'zr-field-label' }, 'Tono'), h(Tabs, { size: 'sm', value: form.tone, onChange: function (v) { set('tone', v); }, 'aria-label': 'Tono', items: ['Professionale', 'Amichevole', 'Ispirazionale', 'Diretto'] })),
          h('div', { className: 'zr-field' }, h('span', { className: 'zr-field-label' }, 'Lunghezza'), h(Tabs, { size: 'sm', value: form.length, onChange: function (v) { set('length', v); }, 'aria-label': 'Lunghezza', items: ['Breve', 'Media', 'Lunga'] })),
          h(Button, { icon: 'sparkle', onClick: run, disabled: loading || !form.topic.trim(), className: 'zr-btn-block' }, loading ? 'Sto scrivendo…' : 'Genera 3 varianti'),
          h(Progress, { label: 'Generazioni questo mese', value: used, max: limit, valueLabel: used + ' di ' + limit }))),
      h('section', { className: 'zr-studio-out', 'aria-live': 'polite' },
        loading ? [0, 1, 2].map(function (i) { return h('div', { key: i, className: 'zr-panel zr-variant' }, h(Skeleton, { lines: 4 })); })
          : out ? out.map(function (it, i) {
            return h('article', { key: it.id, className: 'zr-panel zr-variant' },
              h('header', { className: 'zr-variant-head' }, h(Label, { tone: 'coral' }, 'Variante ' + (i + 1)), h('span', null, it.text.split(/\s+/).length + ' parole')),
              h('p', { className: 'zr-variant-text' }, it.text),
              h('footer', { className: 'zr-variant-actions' },
                h(Button, { variant: 'secondary', size: 'sm', icon: copied === it.id ? 'check' : 'copy', onClick: function () { copy(it); } }, copied === it.id ? 'Copiato' : 'Copia'),
                h(Button, { variant: 'ghost', size: 'sm', icon: 'refresh', onClick: run }, 'Rigenera'),
                h(Button, { variant: 'ghost', size: 'sm', icon: 'star', onClick: p.onSave ? function () { p.onSave(it); } : undefined }, 'Salva')));
          })
          : h(EmptyState, { icon: 'sparkle', tone: 'coral', title: 'Il tuo testo apparirà qui', text: 'Scegli tipo, argomento e tono, poi premi "Genera". Riceverai tre varianti da copiare o salvare.' })));
  }


  /* ---------- Menu (P-15: menu contestuali e «+») ---------- */
  function Menu(p) {
    var ref = useRef(null);
    React.useEffect(function () {
      function close(e) { if (ref.current && !ref.current.contains(e.target) && e.target !== p.anchor && !(p.anchor && p.anchor.contains && p.anchor.contains(e.target))) p.onClose(); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); p.onClose(); if (p.anchor && p.anchor.focus) p.anchor.focus(); } }
      var t = setTimeout(function () { document.addEventListener('mousedown', close); }, 0);
      document.addEventListener('keydown', key, true);
      var first = ref.current && ref.current.querySelector('[role="menuitem"]:not(:disabled)'); if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      return function () { clearTimeout(t); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key, true); };
    }, []);
    var items = p.items || [];
    var r = p.anchor && p.anchor.getBoundingClientRect ? p.anchor.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
    var W = 240, vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    var left = Math.max(8, Math.min(p.align === 'end' ? r.right - W : r.left, vw - W - 8));
    var top = r.bottom + 6; if (!p.head && top > vh - 40 * items.length - 16) top = Math.max(8, r.top - 6 - 38 * items.length);
    function move(e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var list = Array.prototype.slice.call(ref.current.querySelectorAll('[role="menuitem"]:not(:disabled)'));
      var i = list.indexOf(document.activeElement); var n = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]; if (n) n.focus();
    }
    return h('div', { ref: ref, className: cx('zr-menu', p.className), role: 'menu', 'aria-label': p.label, style: p.inline ? null : { top: top, left: left }, onKeyDown: move },
      p.head ? h('div', { className: 'zr-menu-head', role: 'presentation' }, p.head) : null,
      items.map(function (it, i) {
        if (it.sep) return h('div', { key: 'sep' + i, className: 'zr-menu-sep', role: 'separator' });
        return h('button', { key: i, type: 'button', role: 'menuitem', className: cx('zr-menu-item', it.danger && 'is-danger'), disabled: it.disabled,
          onClick: function () { p.onClose && p.onClose(); if (it.onClick) it.onClick(); } },
          it.icon ? h(Icon, { name: it.icon, size: 16 }) : null, h('span', { className: 'zr-menu-label' }, it.label), it.hint ? h('kbd', { className: 'zr-kbd' }, it.hint) : null);
      }));
  }

  /* ---------- Composer (P-15: creazione in linea) ---------- */
  function Composer(p) {
    var st = useState(p.defaultValue || ''), v = st[0], set = st[1];
    function submit() { var t = v.trim(); if (!t) { if (p.onCancel) p.onCancel(); return; } if (p.onCreate) p.onCreate(t); set(''); }
    return h('div', { className: cx('zr-composer', p.className) },
      h('textarea', { autoFocus: p.autoFocus !== false, rows: p.rows || (p.multiline ? 2 : 1), value: v, placeholder: p.placeholder, maxLength: p.maxLength, 'aria-label': p.label || p.placeholder,
        onChange: function (e) { set(p.multiline ? e.target.value : e.target.value.replace(/\n/g, '')); },
        onKeyDown: function (e) { if (e.key === 'Enter' && !(p.multiline && e.shiftKey)) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); set(''); if (p.onCancel) p.onCancel(); } } }),
      h('div', { className: 'zr-composer-row' },
        h(Button, { size: 'sm', onClick: submit }, p.submitLabel || 'Aggiungi'),
        h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': 'Annulla', onClick: function () { set(''); if (p.onCancel) p.onCancel(); } })));
  }

  /* ---------- DetailPanel (P-15: dettaglio nel pannello a destra) ---------- */
  function DetailPanel(p) {
    var ref = useRef(null);
    React.useEffect(function () {
      var origin = document.activeElement;
      var t = ref.current && (ref.current.querySelector('[data-autofocus]') || ref.current);
      if (t && t.focus) try { t.focus({ preventScroll: true }); } catch (e) {}
      function key(e) { if (e.key === 'Escape' && p.onClose && !document.querySelector('.zr-scrim') && !document.querySelector('.zr-menu')) p.onClose(); }
      document.addEventListener('keydown', key);
      return function () {
        document.removeEventListener('keydown', key);
        var id = origin && origin.getAttribute && origin.getAttribute('data-id');
        var back = id ? document.querySelector('[data-id="' + id + '"]') : origin;
        if (back && document.contains(back) && back.focus && !document.querySelector('.zr-detail')) try { back.focus({ preventScroll: true }); } catch (e) {}
      };
    }, []);
    return h('aside', { ref: ref, tabIndex: -1, className: cx('zr-detail', p.inline && 'is-inline', p.className), role: 'dialog', 'aria-modal': 'false', 'aria-label': p.label },
      h('header', { className: 'zr-detail-head' },
        h(Button, { variant: 'ghost', size: 'sm', icon: 'chevronLeft', className: 'zr-detail-back', onClick: p.onBack || p.onClose }, p.backLabel || 'Indietro'),
        h('div', { className: 'zr-detail-ctx' }, p.head),
        h(Button, { variant: 'ghost', size: 'sm', icon: 'close', className: 'zr-detail-close', 'aria-label': 'Chiudi', onClick: p.onClose })),
      h('div', { className: 'zr-detail-body' }, p.children),
      p.foot ? h('footer', { className: 'zr-detail-foot' }, p.foot) : null);
  }

  window.Zeiras = Object.assign(window.Zeiras || {}, {
    Logo: Logo, Button: Button, Label: Label, Avatar: Avatar, AvatarStack: AvatarStack, Icon: Icon,
    AppShell: AppShell, DashboardHome: DashboardHome, ProductTile: ProductTile, ProjectFolder: ProjectFolder,
    KanbanCard: KanbanCard, KanbanColumn: KanbanColumn, KanbanBoard: KanbanBoard,
    SiteHeader: SiteHeader, Hero: Hero, SectionHeading: SectionHeading, StepList: StepList, AudienceGrid: AudienceGrid,
    PricingCard: PricingCard, FAQ: FAQ, CtaBand: CtaBand, SiteFooter: SiteFooter, LandingPage: LandingPage,
    ICON_NAMES: ICON_NAMES, Field: Field, Checkbox: Checkbox, Switch: Switch, Tabs: Tabs, Alert: Alert, Toast: Toast, Dialog: Dialog, EmptyState: EmptyState, Progress: Progress, Skeleton: Skeleton, PageHeader: PageHeader,
    DataTable: DataTable, FilterBar: FilterBar, StatCard: StatCard, ChartCard: ChartCard, LineChart: LineChart, BarChart: BarChart, DonutChart: DonutChart, Sparkline: Sparkline,
    StatusLabel: StatusLabel, RecordHeader: RecordHeader, ActivityTimeline: ActivityTimeline, DescriptionList: DescriptionList, DealCard: DealCard, DealPipeline: DealPipeline, CrmContacts: CrmContacts, ContactDetail: ContactDetail,
    ReportDashboard: ReportDashboard, AutomationStep: AutomationStep, WorkflowBuilder: WorkflowBuilder, AutomationList: AutomationList, ContentStudio: ContentStudio, DetailPanel: DetailPanel, Composer: Composer, Menu: Menu, APPSHELL_LABELS: APPSHELL_LABELS, PUBLISHER: PUBLISHER
  });
})();
