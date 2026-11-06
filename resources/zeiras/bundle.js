/* @ds-bundle: {"format":4,"namespace":"Zeiras","components":[{"name":"Logo"},{"name":"Button"},{"name":"Label"},{"name":"Avatar"},{"name":"AppShell"},{"name":"DashboardHome"},{"name":"ProductTile"},{"name":"ProjectFolder"},{"name":"KanbanCard"},{"name":"KanbanColumn"},{"name":"KanbanBoard"},{"name":"LandingPage"},{"name":"SiteHeader"},{"name":"Hero"},{"name":"PricingCard"},{"name":"FAQ"},{"name":"CtaBand"},{"name":"SiteFooter"},{"name":"Icon"},{"name":"BrandIcon"},{"name":"Field"},{"name":"MentionField"},{"name":"AddressField"},{"name":"Checkbox"},{"name":"RadioGroup"},{"name":"ToggleGroup"},{"name":"InlineEdit"},{"name":"Calendar"},{"name":"Switch"},{"name":"Tabs"},{"name":"Alert"},{"name":"Toast"},{"name":"Dialog"},{"name":"EmptyState"},{"name":"Progress"},{"name":"PageHeader"},{"name":"DataTable"},{"name":"StatCard"},{"name":"LineChart"},{"name":"BarChart"},{"name":"DonutChart"},{"name":"CrmContacts"},{"name":"DealPipeline"},{"name":"DescriptionList"},{"name":"ContactDetail"},{"name":"ReportDashboard"},{"name":"AutomationList"},{"name":"WorkflowBuilder"},{"name":"ContentStudio"},{"name":"DetailPanel"},{"name":"Composer"},{"name":"Menu"},{"name":"SectionHeading"},{"name":"StepList"},{"name":"AudienceGrid"},{"name":"Skeleton"},{"name":"FilterBar"},{"name":"ChartCard"},{"name":"SectionCard"},{"name":"Sparkline"},{"name":"StatusLabel"},{"name":"RecordHeader"},{"name":"ActivityTimeline"},{"name":"DealCard"},{"name":"AutomationStep"},{"name":"LanguageSwitch"},{"name":"SectorGrid"},{"name":"Breadcrumb"},{"name":"AppointmentItem"}]} */
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
    chevronUp: 'M6 15l6-6 6 6', /* la freccia in su: l'ordine crescente, il «chiudi» di un riquadro aperto (richiesta 152) */
    chevronLeft: 'M15 6l-6 6 6 6',
    check: 'M5 12l5 5 9-10',
    file: 'M6 3h8l5 5v13H6zM14 3v5h5',
    form: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    gantt: 'M4 4v16M7 7h7M10 12h10M7 17h6',
    archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4' /* la scatola col coperchio: «Archivia» (richiesta 187) */
  };
  var ICON_NAMES = Object.keys(PATHS);
  /* il numero accanto a un nome: si vede da solo, il lettore di schermo lo sente staccato e col suo nome (richieste 12, 70, 35) */
  function countParts(n, cls, label) { return [h('span', { key: 'cs', className: 'zr-visually-hidden' }, ', ' + (label || n)), h('span', { key: 'cn', className: cls, 'aria-hidden': true }, n)]; }

  function Icon(p) {
    var size = p.size || 20;
    return h('svg', {
      className: cx('zr-icon', p.className), width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: p.name === 'more' ? 3 : 1.75,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false'
    }, h('path', { d: PATHS[p.name] || PATHS.more }));
  }

  /* ---------- BrandIcon ---------- */
  /* I marchi dei servizi esterni (richiesta 199) come li danno i loro proprietari, coi loro colori: non si ridisegnano col
     tratto del set, non si ricolorano e stanno solo accanto al nome del servizio. Gli id interni (maschere, sfumature) sono
     di ogni istanza, così due marchi nella stessa pagina, o uno in un menu chiuso, non si rubano i colori. */
  var BRANDS = {
    'google-calendar': { box: '0 0 800 859.1', svg: '<path fill="#bbe2ff" d="M 64.74,150.87 C 64.74,67.54 132.29,0 215.61,0 h 368.78 c 83.32,0 150.87,67.54 150.87,150.87 v 159.25 c 0,83.32 -67.54,150.87 -150.87,150.87 H 215.61 c -83.32,0 -150.87,-67.54 -150.87,-150.87 z"/><path fill="#3c90ff" d="M 1.19,216.83 C -9.55,135.26 53.95,62.86 136.22,62.86 h 527.56 c 82.27,0 145.77,72.39 135.04,153.97 l -32.13,244.15 32.13,244.15 c 10.73,81.57 -52.76,153.97 -135.04,153.97 H 136.22 c -82.27,0 -145.77,-72.39 -135.04,-153.97 L 33.31,460.98 Z"/><mask id="__ID__0" width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse"><path fill="#3c90ff" d="M 19.87,49.39 C 17.82,33.82 29.94,20 45.65,20 h 100.71 c 15.71,0 27.83,13.82 25.78,29.39 L 166,96 l 6.13,46.61 C 174.18,158.18 162.06,172 146.35,172 H 45.65 C 29.94,172 17.82,158.18 19.87,142.61 L 26,96 Z"/></mask><g mask="url(#__ID__0)" transform="matrix(5.2384,0,0,5.2384,-102.8851,-41.9071)"><path fill="url(#__ID__2)" d="M 0,0 H 166 V 76 H 0 Z" transform="matrix(1,0,0,-1,13,172)"/></g><mask id="__ID__1" width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse"><path fill="#3186ff" d="M 19.87,49.39 C 17.82,33.82 29.94,20 45.65,20 h 100.71 c 15.71,0 27.83,13.82 25.78,29.39 L 166,96 l 6.13,46.61 C 174.18,158.18 162.06,172 146.35,172 H 45.65 C 29.94,172 17.82,158.18 19.87,142.61 L 26,96 Z"/></mask><g mask="url(#__ID__1)" transform="matrix(5.2384,0,0,5.2384,-102.8851,-41.9071)"><path fill="url(#__ID__3)" d="M 32,27.2 C 32,16.6 40.6,8 51.2,8 h 89.6 C 151.4,8 160,16.6 160,27.2 V 96 H 32 Z" filter="url(#__ID__4)"/></g><path fill="#ffffff" d="m 291.84,656.56 q -32.91,0 -56.45,-10.7 -23.55,-10.7 -39.86,-28.63 -16.06,-18.2 -22.75,-35.58 -6.69,-17.39 -5.35,-21.14 a 10.84,10.84 0 0 1 5.35,-5.89 l 29.7,-11.77 q 3.74,-1.87 7.49,-0.53 3.74,1.07 8.83,12.3 5.35,11.24 14.98,23.81 a 74.91,74.91 0 0 0 23.55,19.53 q 13.65,6.96 33.71,6.96 32.37,0 51.37,-18.73 19.26,-18.73 19.26,-47.62 0,-31.3 -20.34,-48.16 Q 321.01,473.28 287.56,473.28 H 259.47 a 9.95,9.95 0 0 1 -6.96,-2.67 q -2.67,-2.94 -2.68,-6.69 v -28.63 q 0,-4.02 2.67,-6.69 a 9.53,9.53 0 0 1 6.96,-2.94 h 24.34 q 29.97,0 48.16,-16.32 18.19,-16.32 18.19,-42.27 0,-25.68 -16.32,-41.47 -16.32,-15.79 -44.95,-15.79 -16.06,0 -27.83,5.35 a 60.24,60.24 0 0 0 -20.34,14.98 118.91,118.91 0 0 0 -14.71,19.8 q -6.15,10.17 -9.9,11.24 -3.74,0.8 -7.22,-1.34 l -28.09,-13.65 q -3.48,-1.88 -4.55,-5.89 -1.07,-4.01 6.42,-18.73 7.76,-14.98 23.54,-30.5 a 110.01,110.01 0 0 1 36.93,-24.08 q 21.14,-8.56 49.23,-8.56 52.17,0 82.67,27.55 30.5,27.29 30.5,72.24 0,31.04 -14.98,53.78 -14.72,22.73 -41.74,32.11 v 1.07 q 32.64,9.63 51.37,35.31 19,25.42 18.99,60.73 0,50.57 -35.32,82.94 -35.31,32.37 -92.04,32.37 z m 268.47,-6.16 q -4.55,0 -8.03,-3.48 a 11.79,11.79 0 0 1 -3.21,-8.29 V 341.11 l -60.2,43.34 q -3.22,2.41 -7.5,1.61 a 10.27,10.27 0 0 1 -6.42,-4.01 l -17.39,-24.62 a 10.37,10.37 0 0 1 -1.88,-7.49 q 0.8,-4.27 4.28,-6.68 l 106.75,-76.26 q 1.34,-1.07 2.94,-1.6 1.61,-0.8 3.75,-0.8 h 22.48 q 4.55,0 7.22,3.21 2.94,2.93 2.94,7.49 v 363.33 q 0,4.82 -3.48,8.29 a 10.48,10.48 0 0 1 -8.03,3.48 z"/><defs><linearGradient id="__ID__2" x1="83" x2="83" y1="76" gradientUnits="userSpaceOnUse"><stop stop-color="#4fa0ff"/><stop offset="1" stop-color="#3186ff"/></linearGradient><linearGradient id="__ID__3" x1="89.06" x2="89.06" y1="21.75" y2="96.39" gradientUnits="userSpaceOnUse"><stop stop-color="#a9a8ff"/><stop offset="0.8" stop-color="#3c90ff"/></linearGradient><filter id="__ID__4" width="152" height="112" x="20" y="-4" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" mode="normal"/><feGaussianBlur result="effect1_foregroundBlur_37330_7673" stdDeviation="6"/></filter></defs>' },
    outlook: { box: '60 90.4 570.02 539.67', svg: '<defs><linearGradient id="__ID__0" gradientUnits="userSpaceOnUse" x1="9.99" y1="22.36" x2="30.93" y2="9.37" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0" stop-color="#20a7fa"/><stop offset="0.4" stop-color="#3bd5ff"/><stop offset="1" stop-color="#c4b0ff"/></linearGradient><linearGradient id="__ID__1" gradientUnits="userSpaceOnUse" x1="17.2" y1="26.79" x2="28.86" y2="8.13" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0" stop-color="#165ad9"/><stop offset="0.5" stop-color="#1880e5"/><stop offset="1" stop-color="#8587ff"/></linearGradient><linearGradient id="__ID__2" gradientUnits="userSpaceOnUse" x1="25.7" y1="27.05" x2="12.76" y2="16.5" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0.24" stop-color="#448aff" stop-opacity="0"/><stop offset="0.79" stop-color="#0032b1" stop-opacity="0.2"/></linearGradient><linearGradient id="__ID__3" gradientUnits="userSpaceOnUse" x1="24.05" y1="31.11" x2="44.51" y2="18.02" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0" stop-color="#1a43a6"/><stop offset="0.49" stop-color="#2052cb"/><stop offset="1" stop-color="#5f20cb"/></linearGradient><linearGradient id="__ID__4" gradientUnits="userSpaceOnUse" x1="29.83" y1="30.33" x2="17.4" y2="19.57" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0" stop-color="#0045b9" stop-opacity="0"/><stop offset="0.67" stop-color="#0d1f69" stop-opacity="0.2"/></linearGradient><radialGradient id="__ID__5" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(0,-405.0405,438.393,0,360.027,102.2682)"><stop offset="0.57" stop-color="#275ff0" stop-opacity="0"/><stop offset="0.99" stop-color="#002177"/></radialGradient><linearGradient id="__ID__6" gradientUnits="userSpaceOnUse" x1="42" y1="29.94" x2="23.85" y2="29.94" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0" stop-color="#4dc4ff"/><stop offset="0.2" stop-color="#0fafff"/></linearGradient><radialGradient id="__ID__7" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(122.7396,-122.7396,122.7396,122.7396,421.392,568.6755)"><stop offset="0.26" stop-color="#0060d1" stop-opacity="0.4"/><stop offset="0.91" stop-color="#0383f1" stop-opacity="0"/></radialGradient><radialGradient id="__ID__8" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(357.407,-468.4459,423.5946,323.1871,159.471,697.08)"><stop offset="0.73" stop-color="#f4a7f7" stop-opacity="0"/><stop offset="1" stop-color="#f4a7f7" stop-opacity="0.501961"/></radialGradient><radialGradient id="__ID__9" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(-170.8609,259.7254,-674.0181,-443.4042,278.562,412.9785)"><stop offset="0" stop-color="#49deff"/><stop offset="0.72" stop-color="#29c3ff"/></radialGradient><linearGradient id="__ID__10" gradientUnits="userSpaceOnUse" x1="3.46" y1="37.87" x2="20.93" y2="37.86" gradientTransform="matrix(15,0,0,15,0,0)"><stop offset="0.21" stop-color="#6ce0ff"/><stop offset="0.54" stop-color="#50d5ff" stop-opacity="0"/></linearGradient><radialGradient id="__ID__11" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(215.7672,230.7691,-230.7691,215.7672,59.1436,354.231)"><stop offset="0.04" stop-color="#0091ff"/><stop offset="0.92" stop-color="#183dad"/></radialGradient><radialGradient id="__ID__12" gradientUnits="userSpaceOnUse" cx="0" cy="0" fx="0" fy="0" r="1" gradientTransform="matrix(0,168,-193.782,0,180,491.1585)"><stop offset="0.56" stop-color="#0fa5f7" stop-opacity="0"/><stop offset="1" stop-color="#74c6ff" stop-opacity="0.501961"/></radialGradient></defs><g><path fill="url(#__ID__0)" d="M 463.98 140.14 L 119.64 358.41 L 90.02 311.7 L 90.02 271.44 C 90.02 256.78 97.45 243.12 109.74 235.14 L 309.91 105.26 C 340.41 85.47 379.69 85.46 410.19 105.25 Z M 463.98 140.14 "/><path fill="url(#__ID__1)" d="M 407.1 103.34 C 408.14 103.95 409.16 104.59 410.18 105.25 L 566.4 206.59 L 179.06 452.11 L 119.62 358.34 L 403.89 177.8 C 430.82 160.7 432 122.23 407.1 103.34 Z M 407.1 103.34 "/><path fill="url(#__ID__2)" d="M 407.1 103.34 C 408.14 103.95 409.16 104.59 410.18 105.25 L 566.4 206.59 L 179.06 452.11 L 119.62 358.34 L 403.89 177.8 C 430.82 160.7 432 122.23 407.1 103.34 Z M 407.1 103.34 "/><path fill="url(#__ID__3)" d="M 333.6 498.99 L 179.07 452.11 L 507.63 243.84 C 535.3 226.3 535.23 185.9 507.5 168.46 L 506.02 167.53 L 510.28 170.18 L 610.27 235.04 C 622.57 243.02 630 256.68 630 271.34 L 630 310.3 Z M 333.6 498.99 "/><path fill="url(#__ID__4)" d="M 333.6 498.99 L 179.07 452.11 L 507.63 243.84 C 535.3 226.3 535.23 185.9 507.5 168.46 L 506.02 167.53 L 510.28 170.18 L 610.27 235.04 C 622.57 243.02 630 256.68 630 271.34 L 630 310.3 Z M 333.6 498.99 "/><path fill="url(#__ID__5)" d="M 410.19 105.25 C 379.69 85.46 340.41 85.47 309.91 105.26 L 109.74 235.14 C 97.45 243.12 90.02 256.78 90.02 271.44 L 90.02 273.41 C 90.51 288.12 98.25 301.68 110.76 309.57 L 359.64 466.48 L 609.16 309.8 C 622.12 301.67 629.98 287.44 629.98 272.14 L 629.98 310.31 L 629.99 271.34 C 629.99 256.68 622.57 243.02 610.27 235.04 Z M 410.19 105.25 "/><path fill="url(#__ID__6)" d="M 315.77 630.05 L 536.22 630.05 C 588 630.05 629.97 588.08 629.97 536.3 L 629.97 272.14 C 629.97 287.44 622.11 301.67 609.15 309.8 L 281.24 515.7 C 263.55 526.8 252.82 546.22 252.82 567.11 C 252.82 601.87 281 630.05 315.77 630.05 Z M 315.77 630.05 "/><path fill="url(#__ID__7)" d="M 315.77 630.05 L 536.22 630.05 C 588 630.05 629.97 588.08 629.97 536.3 L 629.97 272.14 C 629.97 287.44 622.11 301.67 609.15 309.8 L 281.24 515.7 C 263.55 526.8 252.82 546.22 252.82 567.11 C 252.82 601.87 281 630.05 315.77 630.05 Z M 315.77 630.05 "/><path fill="url(#__ID__8)" d="M 315.77 630.05 L 536.22 630.05 C 588 630.05 629.97 588.08 629.97 536.3 L 629.97 272.14 C 629.97 287.44 622.11 301.67 609.15 309.8 L 281.24 515.7 C 263.55 526.8 252.82 546.22 252.82 567.11 C 252.82 601.87 281 630.05 315.77 630.05 Z M 315.77 630.05 "/><path fill="url(#__ID__9)" d="M 405.4 630.04 L 183.74 630.04 C 131.96 630.04 89.99 588.06 89.99 536.29 L 89.99 271.95 C 89.99 287.22 97.82 301.42 110.74 309.57 L 438.32 516.09 C 456.26 527.39 467.13 547.11 467.13 568.31 C 467.13 602.4 439.49 630.04 405.4 630.04 Z M 405.4 630.04 "/><path fill="url(#__ID__10)" d="M 405.4 630.04 L 183.74 630.04 C 131.96 630.04 89.99 588.06 89.99 536.29 L 89.99 271.95 C 89.99 287.22 97.82 301.42 110.74 309.57 L 438.32 516.09 C 456.26 527.39 467.13 547.11 467.13 568.31 C 467.13 602.4 439.49 630.04 405.4 630.04 Z M 405.4 630.04 "/><path fill="url(#__ID__11)" d="M 108.75 345 L 251.25 345 C 278.18 345 300 366.82 300 393.75 L 300 536.25 C 300 563.18 278.18 585 251.25 585 L 108.75 585 C 81.82 585 60 563.18 60 536.25 L 60 393.75 C 60 366.82 81.82 345 108.75 345 Z M 108.75 345 "/><path fill="url(#__ID__12)" d="M 108.75 345 L 251.25 345 C 278.18 345 300 366.82 300 393.75 L 300 536.25 C 300 563.18 278.18 585 251.25 585 L 108.75 585 C 81.82 585 60 563.18 60 536.25 L 60 393.75 C 60 366.82 81.82 345 108.75 345 Z M 108.75 345 "/><path fill="#ffffff" d="M 179.39 534 C 159.54 534 143.25 527.79 130.51 515.38 C 117.77 502.96 111.4 486.76 111.4 466.77 C 111.4 445.66 117.87 428.59 130.8 415.55 C 143.73 402.52 160.66 396 181.59 396 C 201.38 396 217.47 402.24 229.89 414.71 C 242.38 427.19 248.62 443.64 248.62 464.07 C 248.62 485.05 242.15 501.96 229.22 514.82 C 216.35 527.61 199.74 534 179.39 534 Z M 179.96 507.65 C 190.78 507.65 199.48 503.95 206.08 496.57 C 212.67 489.18 215.97 478.9 215.97 465.74 C 215.97 452.02 212.77 441.35 206.37 433.71 C 199.96 426.07 191.42 422.26 180.73 422.26 C 169.72 422.26 160.85 426.2 154.13 434.08 C 147.41 441.91 144.05 452.27 144.05 465.18 C 144.05 478.29 147.41 488.65 154.13 496.29 C 160.85 503.86 169.46 507.65 179.96 507.65 Z M 179.96 507.65 "/><path fill="#ffffff" d="M 179.33 535.85 C 159.56 535.85 143.33 529.47 130.64 516.72 C 117.95 503.96 111.61 487.32 111.61 466.79 C 111.61 445.11 118.05 427.57 130.93 414.18 C 143.81 400.79 160.68 394.09 181.53 394.09 C 201.23 394.09 217.27 400.5 229.64 413.32 C 242.08 426.14 248.3 443.04 248.3 464.02 C 248.3 485.57 241.86 502.95 228.98 516.14 C 216.16 529.28 199.61 535.85 179.33 535.85 Z M 179.9 508.78 C 190.68 508.78 199.36 504.98 205.92 497.4 C 212.49 489.81 215.77 479.25 215.77 465.73 C 215.77 451.64 212.59 440.68 206.21 432.83 C 199.83 424.99 191.32 421.07 180.67 421.07 C 169.7 421.07 160.87 425.11 154.17 433.21 C 147.48 441.25 144.13 451.9 144.13 465.16 C 144.13 478.62 147.48 489.27 154.17 497.11 C 160.87 504.89 169.45 508.78 179.9 508.78 Z M 179.9 508.78 "/></g>' }
  };
  var BRAND_ICON_NAMES = Object.keys(BRANDS);
  function BrandIcon(p) {
    var id = 'zrb' + React.useId().replace(/[^A-Za-z0-9_-]/g, '');
    var b = BRANDS[p.name];
    if (!b) return null;
    var size = p.size || 20;
    return h('svg', {
      className: cx('zr-brand-icon', p.className), width: size, height: size, viewBox: b.box, focusable: 'false',
      role: p.title ? 'img' : undefined, 'aria-label': p.title || undefined, 'aria-hidden': p.title ? undefined : true,
      dangerouslySetInnerHTML: { __html: b.svg.replace(/__ID__/g, id + '-') }
    });
  }

  /* ---------- Button ---------- */
  function Button(p) {
    var v = p.variant || 'primary', s = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'icon', 'className', 'children', 'busy']);
    /* busy: l'azione è partita e si aspetta. Resta raggiungibile col fuoco, ma né il clic né l'invio del modulo partono di nuovo (richiesta 99) */
    if (p.busy) rest = Object.assign(rest, { 'aria-busy': true, 'aria-disabled': true, onClick: function (e) { e.preventDefault(); } });
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('zr-btn', 'zr-btn-' + v, 'zr-btn-' + s, !p.children && 'zr-btn-icon', p.busy && 'is-busy', p.className)
    }), p.busy ? h('span', { className: 'zr-btn-spin', 'aria-hidden': true }) : p.icon ? h(Icon, { name: p.icon, size: s === 'sm' ? 16 : 18 }) : null, p.children ? h('span', null, p.children) : null);
  }

  /* ---------- Label ---------- */
  var TONES = ['pine', 'citrus', 'coral', 'sky', 'plum', 'neutral'];
  function Label(p) {
    var tone = TONES.indexOf(p.tone) >= 0 ? p.tone : 'neutral', vid = useId('lbl'), C = useLabels();
    /* variant="type": il tipo di una cosa (Storia, Bug…), a contorno col puntino del tono, da non confondere con le etichette scelte (richiesta 154) */
    if (p.variant === 'type') return h('span', { className: cx('zr-label', 'zr-label-type', p.wrap && 'is-wrap', p.className) }, h('span', { className: cx('zr-label-dot', 'is-' + tone), 'aria-hidden': true }), p.children);
    /* un'etichetta che si aggiunge («+») o si toglie («×»): il nome del pulsante dice anche quale, col testo dell'etichetta anche quando è un nodo (richiesta 143); wrap: una frase lunga va a capo (richiesta 161) */
    if (p.onAdd) return h('button', { type: 'button', className: cx('zr-label', 'zr-label-add', p.wrap && 'is-wrap', p.className), onClick: p.onAdd }, h(Icon, { name: 'plus', size: 14 }), h('span', { className: 'zr-visually-hidden' }, (p.addLabel || C.add) + ': '), p.children);
    return h('span', { className: cx('zr-label', 'zr-label-' + tone, p.wrap && 'is-wrap', p.onRemove && 'has-remove', p.className) }, p.onRemove ? h('span', { id: vid + '-t' }, p.children) : p.children,
      p.onRemove ? h('button', { type: 'button', className: 'zr-label-x', onClick: p.onRemove, 'aria-labelledby': vid + ' ' + vid + '-t' }, h('span', { id: vid, className: 'zr-visually-hidden' }, (p.removeLabel || C.remove) + ':'), h(Icon, { name: 'close', size: 12 })) : null);
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
    var failSt = useState(null), failed = failSt[0], setFailed = failSt[1];
    var photo = p.src && failed !== p.src ? p.src : null; /* senza foto, o se non si carica: le iniziali */
    return h('span', {
      className: cx('zr-avatar', 'zr-avatar-' + size, 'zr-label-' + (p.tone || toneFor(p.name)), photo && 'has-photo', p.className),
      title: p.decorative ? undefined : p.name, role: p.decorative ? undefined : 'img', 'aria-label': p.decorative ? undefined : p.name, 'aria-hidden': p.decorative ? 'true' : undefined /* decorative: il nome è già accanto (richiesta 109) */
    }, initials(p.name), photo ? h('img', { className: 'zr-avatar-img', src: photo, alt: '', onError: function () { setFailed(photo); } }) : null);
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
  var DEFAULT_NAV = [MODULES_NAV];

  /* Testi fissi dell'AppShell: tutti sostituibili con la prop labels (it di default) */
  var APPSHELL_LABELS = {
    soon: 'Presto', off: 'Da attivare', settings: 'Impostazioni', planTitle: 'Piano Personale', planText: 'Gratis, senza limiti per i progetti personali',
    nav: 'Navigazione principale', openMenu: 'Apri il menu', closeMenu: 'Chiudi il menu', userFallback: 'Utente Zeiras', create: 'Crea',
    workspaceSwitch: 'Cambia workspace', newWorkspace: 'Nuovo workspace', workspaceSettings: 'Impostazioni del workspace',
    personal: 'Il mio spazio', personalGroup: 'Come cliente', firstWorkspace: 'Crea il tuo workspace',
    search: 'Cerca', searchPlaceholder: 'Cerca progetti, schede, contatti…', searchHint: 'Cerca in tutti i moduli: scrivi almeno 2 caratteri.', searchSubmitHint: 'Cerca in tutti i moduli: scrivi almeno 2 caratteri e premi Invio.', searchPressEnter: 'Premi Invio per cercare',
    searchLoading: 'Sto cercando…', searchEmpty: 'Nessun risultato per', searchEmptyText: 'Prova con un\'altra parola o controlla di essere nel workspace giusto.',
    searchError: 'La ricerca non ha risposto. Riprova tra poco.', searchResults: 'Risultati della ricerca', searchCount: 'Risultati: {n}',
    notifications: 'Notifiche', unread: 'non lette', unreadOne: 'non letta', unreadNone: 'Nessuna notifica non letta', forMe: 'Per me', all: 'Tutte', markAllRead: 'Segna tutte come lette', seeAll: 'Vedi tutte',
    notificationsEmpty: 'Nessuna notifica', notificationsEmptyText: 'Ti avviseremo qui quando qualcuno ti menziona o ti assegna qualcosa.',
    notificationsError: 'Non riusciamo a caricare le notifiche.', retry: 'Riprova', loading: 'Caricamento',
    account: 'Il tuo account', profile: 'Profilo', accountSettings: 'Impostazioni', plan: 'Piano', company: 'Azienda', logout: 'Esci',
    crumbs: 'Percorso', mainContent: 'Contenuto', skipToContent: 'Salta al contenuto'
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

  /* La riga di una notifica (P-07): la stessa nel pannello della campanella e in una pagina; con href è un link (richiesta 166) */
  function NotificationItem(p) {
    var C = useLabels(), cls = cx('zr-notif-item', p.unread && 'is-unread', p.className);
    return h(p.href ? 'a' : 'button', p.href ? { href: p.href, className: cls, onClick: p.onClick } : { type: 'button', className: cls, onClick: p.onClick },
      p.actor ? h(Avatar, { name: p.actor, size: 'sm' }) : h('span', { className: cx('zr-iconbox', 'zr-iconbox-sm', 'zr-label-' + (p.tone || 'neutral')) }, h(Icon, { name: p.icon || 'bell', size: 16 })),
      h('span', { className: 'zr-notif-text' },
        h('span', { className: 'zr-notif-title' }, p.title),
        p.text ? h('span', { className: 'zr-notif-sub' }, p.text) : null,
        (p.time || p.product) ? h('span', { className: 'zr-notif-meta' }, [p.product, p.time].filter(Boolean).join(' · ')) : null),
      p.unread ? h('span', { className: 'zr-notif-dot', 'aria-label': p.unreadLabel || C.unread }) : null);
  }

  /* AppointmentItem: la riga di un appuntamento (Bookings, Il mio spazio). Testi già scritti dal modulo nella sua lingua. */
  function AppointmentItem(p) {
    var past = !!p.past, canceled = p.statusTone === 'coral' || p.canceled;
    var titleId = useRef('zr-appt-' + Math.random().toString(36).slice(2, 8)).current;
    var title = p.href ? h('a', { href: p.href, onClick: p.onOpen, className: 'zr-appt-title', id: titleId }, p.title)
      : p.onOpen ? h('button', { type: 'button', onClick: p.onOpen, className: 'zr-appt-title', id: titleId }, p.title)
      : h('span', { className: 'zr-appt-title', id: titleId }, p.title);
    return h('article', { className: cx('zr-appt', past && 'is-past', canceled && 'is-canceled', p.compact && 'is-compact', p.className), 'aria-labelledby': titleId },
      h('div', { className: 'zr-appt-date', 'aria-hidden': p.dateLabel ? 'true' : undefined },
        h('span', { className: 'zr-appt-wd' }, p.weekday),
        h('span', { className: 'zr-appt-day' }, p.day),
        h('span', { className: 'zr-appt-month' }, p.month)),
      p.dateLabel ? h('span', { className: 'zr-visually-hidden' }, p.dateLabel) : null,
      h('div', { className: 'zr-appt-body' },
        h('div', { className: 'zr-appt-head' }, title, p.status ? h(StatusLabel, { status: p.status, tone: p.statusTone || 'pine' }) : null),
        h('div', { className: 'zr-appt-meta' },
          p.time ? h('span', { className: 'zr-appt-m' }, h(Icon, { name: 'clock', size: 14 }), h('span', null, p.time)) : null,
          p.place ? h('span', { className: 'zr-appt-m' }, h(Icon, { name: p.online ? 'link' : 'home', size: 14 }), h('span', null, p.place)) : null,
          p.provider ? h('span', { className: 'zr-appt-m' }, h('span', { className: 'zr-ws-dot', style: { background: 'var(--' + (p.providerTone || 'pine') + ')' }, 'aria-hidden': 'true' }), h('span', null, p.provider)) : null),
        p.note ? h('p', { className: 'zr-appt-note' }, p.note) : null,
        p.actions ? h('div', { className: 'zr-appt-actions' }, p.actions) : null));
  }

  var SHELL_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  /* ciò che scorre entra nel giro del Tab finché dentro niente prende il fuoco; un tabindex che ha già resta (richieste 30 e 129) */
  function scrollStop(el, ifScrolls) { /* ifScrolls: la fermata solo finché il contenuto non ci sta (richiesta 129) */
    var mine = false;
    function fix() { var want = !el.querySelector(SHELL_FOCUSABLE) && (!ifScrolls || el.scrollHeight > el.clientHeight); if (!want && mine && el.ownerDocument.activeElement !== el) { el.removeAttribute('tabindex'); mine = false; } else if (want && !mine && !el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); mine = true; } }
    fix(); var mo = new MutationObserver(fix); mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'disabled', 'tabindex', 'contenteditable'] });
    el.addEventListener('blur', fix); /* la fermata non cade sotto il fuoco: si toglie quando il fuoco se ne va */
    var ro = ifScrolls && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null; if (ro) ro.observe(el);
    return function () { mo.disconnect(); el.removeEventListener('blur', fix); if (ro) ro.disconnect(); if (mine) el.removeAttribute('tabindex'); };
  }
  function AppShell(p) {
    var L = Object.assign({}, APPSHELL_LABELS, p.labels);
    var nav = p.nav || DEFAULT_NAV;
    var active = p.active === null ? null : (p.active || 'home'); /* null: nessuna voce attiva (richiesta 29) */
    var user = p.user || L.userFallback;
    var prodGroup = p.product ? nav.find(function (g) { return g.products || (g.group === 'Prodotti' || g.group === 'Moduli'); }) : null;
    var current = prodGroup ? prodGroup.items.find(function (it) { return it.id === p.product; }) : null;
    var openSt = useState(false), open = openSt[0], setOpen = openSt[1];
    var drawerSt = useState(false), drawer = drawerSt[0], setDrawer = drawerSt[1];
    var popSt = useState(null), pop = popSt[0], setPop = popSt[1]; /* 'ws' | 'notif' | 'profile' | 'search' */
    var createSt = useState(null), createAt = createSt[0], setCreateAt = createSt[1];
    var qSt = useState(''), q = qSt[0], setQ = qSt[1];
    var hiSt = useState(0), hi = hiSt[0], setHi = hiSt[1];
    var tabSt = useState('me'), tab = tabSt[0], setTab = tabSt[1];
    var switchRef = useRef(null), prodRef = useRef(null), wsRef = useRef(null), wsBtn = useRef(null), bellRef = useRef(null), notifRef = useRef(null);
    var avatarRef = useRef(null), searchRef = useRef(null), inputRef = useRef(null), timer = useRef(null), mainRef = useRef(null);
    var ids = useRef(null); if (!ids.current) { uid += 1; ids.current = 'zr-shell-' + uid; }
    var sid = ids.current;

    useEffect(function () { if (!drawer) return; function k(e) { if (e.key === 'Escape' && !document.querySelector('.zr-scrim') && !pop) setDrawer(false); } document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); }; }, [drawer, pop]);
    /* Ctrl+K / Cmd+K apre la ricerca da ogni pagina; con search={false} la ricerca non c'è e il tasto resta della pagina (richiesta 201) */
    var noSearch = p.search === false;
    useEffect(function () {
      if (noSearch) return;
      function k(e) { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setDrawer(false); setPop('search'); if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } } }
      document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); };
    }, [noSearch]);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    useOutside(pop === 'ws', [wsRef], function () { setPop(null); });
    useOutside(pop === 'notif', [notifRef, bellRef], function () { setPop(null); });
    useOutside(pop === 'search', [searchRef], function () { setPop(null); });
    useOutside(open, [prodRef], function () { setOpen(false); }); /* il menu Moduli si chiude anche col clic fuori, come gli altri (richiesta 211) */
    useEffect(function () {
      if (pop !== 'notif') return;
      function k(e) { if (e.key === 'Escape') { e.stopPropagation(); setPop(null); if (bellRef.current) bellRef.current.focus(); } }
      document.addEventListener('keydown', k, true); return function () { document.removeEventListener('keydown', k, true); };
    }, [pop]);
    var notifOpenRef = useRef(false); /* il pannello delle notifiche si chiude da qualunque strada: una chiamata sola (richiesta 91) */
    useEffect(function () { if (pop === 'notif') { notifOpenRef.current = true; return; } if (notifOpenRef.current) { notifOpenRef.current = false; if (p.onNotificationsClose) p.onNotificationsClose(); } }, [pop]);

    /* con navigate un clic semplice su una voce con href di questa origine non ricarica la pagina (richieste 27 e 98); Ctrl, Cmd, Maiusc, Alt, il tasto centrale e un'altra origine restano del browser */
    function spa(e) { var a = e && e.currentTarget; return !!(p.navigate && a && a.href && !e.defaultPrevented && !e.button && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && a.protocol === location.protocol && a.host === location.host); }
    function go(it, e) { var to = it.href && spa(e) ? e.currentTarget.href : null; if ((!it.href || to) && e) e.preventDefault(); if (it.soon) return; setOpen(false); setDrawer(false); setPop(null); if (p.onNavigate) p.onNavigate(it.id); if (to) p.navigate(to); }
    function item(it) {
      var isActive = it.id === active;
      return h('a', {
        key: it.id, href: it.href || '#', className: cx('zr-nav-item', isActive && 'is-active', it.soon && 'is-soon', it.off && 'is-off'),
        'aria-current': isActive ? 'page' : undefined, 'aria-disabled': it.soon ? 'true' : undefined, tabIndex: it.soon ? -1 : undefined,
        onClick: function (e) { go(it, e); }
      },
        h(Icon, { name: it.icon, size: 18 }),
        h('span', { className: 'zr-nav-label' }, it.label),
        it.soon ? h('span', { className: 'zr-nav-soon' }, h('span', { className: 'zr-visually-hidden' }, ', '), L.soon) : it.off ? h('span', { className: 'zr-nav-soon' }, h('span', { className: 'zr-visually-hidden' }, ', '), L.off) : null,
        it.count ? countParts(it.count, 'zr-count', it.countLabel) : null);
    }

    /* ---- Selettore Azienda › workspace ---- */
    var companies = p.companies || [];
    var curCompany = null, curWs = null;
    companies.forEach(function (c) { (c.workspaces || []).forEach(function (w) { if (w.slug === p.workspaceSlug) { curCompany = c; curWs = w; } }); });
    var personal = p.personal || null, onPersonal = !!(personal && personal.active); /* «Il mio spazio»: la persona come cliente (zr-account) */
    if (onPersonal) { curCompany = null; curWs = null; }
    else if (!curCompany && companies.length) { curCompany = companies[0]; curWs = (curCompany.workspaces || [])[0] || null; }
    function wsKeys(e) {
      if (e.key === 'Escape') { e.stopPropagation(); setPop(null); if (wsBtn.current) wsBtn.current.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      var list = Array.prototype.slice.call(wsRef.current.querySelectorAll('.zr-ws-item')); if (!list.length) return;
      e.preventDefault();
      var i = list.indexOf(document.activeElement); var n = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]; if (n) n.focus(); /* Home e Fine: la prima e l'ultima voce (richiesta 48) */
    }
    useEffect(function () { if (pop === 'ws' && wsRef.current) { var a = wsRef.current.querySelector('.zr-ws-item[aria-current]') || wsRef.current.querySelector('.zr-ws-item'); if (a) a.focus({ preventScroll: true }); } }, [pop]);
    var wsSettings = !!(curWs && (p.workspaceSettingsHref || p.onWorkspaceSettings));
    var personalName = personal ? (personal.label || L.personal) : '';
    var wsSwitch = (companies.length || personal) ? h('div', { ref: wsRef, className: cx('zr-ws', pop === 'ws' && 'is-open'), onKeyDown: wsKeys, onBlur: function (e) { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setPop(function (v) { return v === 'ws' ? null : v; }); } /* il fuoco esce verso un altro elemento: il selettore si chiude (richiesta 48) */ },
      h('button', { ref: wsBtn, type: 'button', className: 'zr-ws-switch', 'aria-expanded': pop === 'ws' ? 'true' : 'false', 'aria-controls': sid + '-ws', 'aria-label': L.workspaceSwitch + ': ' + (onPersonal ? L.personalGroup + ' › ' + personalName : (curCompany ? curCompany.name + ' › ' : '') + (curWs ? curWs.name : '')),
        onClick: function () { setPop(pop === 'ws' ? null : 'ws'); } },
        onPersonal ? h('span', { className: 'zr-iconbox zr-iconbox-sm zr-label-pine zr-ws-me', 'aria-hidden': 'true' }, h(Icon, { name: 'user', size: 16 })) : null,
        h('span', { className: 'zr-ws-text' },
          h('span', { className: 'zr-ws-company' }, onPersonal ? L.personalGroup : (curCompany ? curCompany.name : '')),
          h('span', { className: 'zr-ws-name' }, onPersonal ? personalName : (curWs ? curWs.name : ''))),
        h(Icon, { name: 'chevronDown', size: 16, className: 'zr-ws-chev' })),
      pop === 'ws' ? h('div', { id: sid + '-ws', className: 'zr-ws-menu', role: 'group', 'aria-label': L.workspaceSwitch },
        personal ? h('div', { className: 'zr-ws-group' },
          h('div', { className: 'zr-ws-group-title' }, h(Icon, { name: 'user', size: 14 }), h('span', null, L.personalGroup)),
          h(personal.href ? 'a' : 'button', { type: personal.href ? undefined : 'button', href: personal.href, className: cx('zr-ws-item', onPersonal && 'is-active'), 'aria-current': onPersonal ? 'true' : undefined,
            onClick: function (e) { setPop(null); setDrawer(false); if (!onPersonal && personal.onSelect) personal.onSelect(e); } },
            h('span', { className: 'zr-ws-dot', style: { background: 'var(--pine)' }, 'aria-hidden': 'true' }),
            h('span', { className: 'zr-nav-label' }, personalName),
            onPersonal ? h(Icon, { name: 'check', size: 16 }) : null)) : null,
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
        p.onNewWorkspace || wsSettings ? h('div', { className: 'zr-product-sep', role: 'separator' }) : null,
        wsSettings ? h(p.workspaceSettingsHref ? 'a' : 'button', { type: p.workspaceSettingsHref ? undefined : 'button', href: p.workspaceSettingsHref, className: 'zr-ws-item zr-ws-new',
          onClick: function (e) { setPop(null); setDrawer(false); if (p.onWorkspaceSettings) p.onWorkspaceSettings(e, curWs ? curWs.slug : undefined, curCompany ? curCompany.id : undefined); } },
          h(Icon, { name: 'settings', size: 16 }), h('span', { className: 'zr-nav-label' }, L.workspaceSettings)) : null,
        p.onNewWorkspace ? h('button', { type: 'button', className: 'zr-ws-item zr-ws-new', onClick: function () { setPop(null); setDrawer(false); p.onNewWorkspace(curCompany ? curCompany.id : undefined); } },
          h(Icon, { name: 'plus', size: 16 }), h('span', { className: 'zr-nav-label' }, companies.length ? L.newWorkspace : L.firstWorkspace)) : null) : null)
      : (p.workspace ? h('span', { className: 'zr-workspace' }, p.workspace) : null);

    /* ---- Menu Prodotti collassabile ---- */
    var switcher = current ? h('div', { ref: prodRef, className: cx('zr-product', open && 'is-open'), onBlur: function (e) { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false); } /* il fuoco esce dal pulsante e dalla lista: il menu si chiude, come selettore e ricerca (richiesta 212) */ },
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
          key: it.id, href: it.href || '#', className: cx('zr-nav-item', isCur && 'is-active', it.soon && 'is-soon', it.off && 'is-off'),
          'aria-current': isCur ? 'true' : undefined, 'aria-disabled': it.soon ? 'true' : undefined, tabIndex: it.soon ? -1 : undefined,
          onClick: function (e) { if (!it.href) e.preventDefault(); if (isCur) { setOpen(false); return; } go(it, e); }
        },
          h(Icon, { name: it.icon, size: 18 }),
          h('span', { className: 'zr-nav-label' }, it.label),
          it.soon ? h('span', { className: 'zr-nav-soon' }, h('span', { className: 'zr-visually-hidden' }, ', '), L.soon) : it.off ? h('span', { className: 'zr-nav-soon' }, h('span', { className: 'zr-visually-hidden' }, ', '), L.off) : isCur ? h(Icon, { name: 'check', size: 16 }) : null);
      }).reduce(function (acc, el, i) { acc.push(el); var it = prodGroup.items[i]; if (it.home && i < prodGroup.items.length - 1) acc.push(h('div', { key: 'sep', className: 'zr-product-sep', role: 'separator' })); return acc; }, [])) : null) : null;
    var groups = nav.filter(function (g) { return !(prodGroup && g === prodGroup); });

    /* ---- Ricerca ---- */
    var results = p.searchResults || [];
    /* fra il tasto e onSearch (300 ms) la ricerca è già in caricamento: non «Nessun risultato» per la parola nuova né i risultati della vecchia (richiesta 46) */
    var pendSt = useState(false), pending = pendSt[0], setPending = pendSt[1];
    var sState = pending && q.trim().length >= 2 ? 'loading' : p.searchState || 'ready';
    var showPanel = pop === 'search';
    var onSubmit = p.searchOn === 'submit'; /* la ricerca parte solo con Invio */
    var askedSt = useState(null), asked = askedSt[0], setAsked = askedSt[1];
    useEffect(function () { if (pop !== 'search') setAsked(null); }, [pop]); /* chiuso il pannello, la parola si ricerca con Invio */
    function runSearch(v) {
      setQ(v); setHi(0); setPop('search');
      clearTimeout(timer.current);
      var go = !onSubmit && v.trim().length >= 2 && p.onSearch; setPending(!!go);
      if (go) timer.current = setTimeout(function () { setPending(false); p.onSearch(v.trim()); }, 300);
    }
    function pick(r) { if (!r) return; setPop(null); if (inputRef.current) inputRef.current.blur(); if (p.onSelectResult) p.onSelectResult(r); }
    function searchKeys(e) {
      if (e.key === 'Escape') { e.preventDefault(); if (showPanel) { e.stopPropagation(); setPop(null); } return; } /* il fuoco resta nel campo, con la parola (richiesta 47); a pannello chiuso Esc arriva alla pagina, e il campo non si svuota */
      if (onSubmit && e.key === 'Enter' && q.trim().length >= 2 && (q.trim() !== asked || sState === 'error' || (sState === 'ready' && !results.length))) { e.preventDefault(); setAsked(q.trim()); setHi(0); setPop('search'); if (p.onSearch) p.onSearch(q.trim()); return; }
      if (!showPanel || q.trim().length < 2 || !results.length || sState !== 'ready' || (onSubmit && q.trim() !== asked)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = (hi + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length; arrowed.current = n; setHi(n); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(results[hi]); }
    }
    var qOk = q.trim().length >= 2;
    var panelBody;
    if (!qOk) panelBody = h('p', { className: 'zr-search-note' }, onSubmit ? L.searchSubmitHint : L.searchHint);
    else if (onSubmit && q.trim() !== asked) panelBody = h('p', { className: 'zr-search-note' }, h('strong', null, L.searchPressEnter + ' «' + q.trim() + '»'));
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
    /* con le frecce l'opzione attiva scorre in vista, quanto basta; il mouse non fa scorrere (richiesta 135): scorre solo l'opzione che la freccia ha scelto, e una freccia che non la cambia (un risultato solo) non lascia il segno al mouse */
    var arrowed = useRef(null);
    useEffect(function () { var t = arrowed.current; arrowed.current = null; if (t !== hi) return; var o = document.getElementById(sid + '-r' + hi); var pn = o && o.closest('.zr-search-panel'); if (pn && hi === 0) pn.scrollTop = 0; else if (o) o.scrollIntoView({ block: 'nearest' }); }, [hi]); /* la prima: il pannello in cima, col suo gruppo */
    var listOpen = showPanel && qOk && sState === 'ready' && results.length > 0 && !(onSubmit && q.trim() !== asked);
    /* quanti risultati, in una zona viva sempre montata: vuota mentre cerca, così lo stesso numero si dice di nuovo (richiesta 134) */
    var countText = listOpen ? (L.searchCount || '').replace('{n}', function () { return results.length; }) : '';

    /* ---- Notifiche ---- */
    var notes = p.notifications || [];
    var nState = p.notificationsState || 'ready';
    var unread = p.unreadCount != null ? p.unreadCount : notes.filter(function (n) { return n.unread; }).length;
    /* la zona viva delle notifiche: dice l'ultimo dei due che cambia, notificationsNotice (richiesta 14) o il numero sceso (richiesta 56) */
    var liveSt = useState([p.notificationsNotice || '', 'notice']), live = liveSt[0], setLive = liveSt[1];
    /* il numero che scende entro 10 s da un clic su una notifica non letta si dice col numero vero; un cambio per altro toglie ciò che aveva detto (richiesta 56) */
    var readClick = useRef(0), prevUnread = useRef(unread);
    useEffect(function () {
      var before = prevUnread.current; prevUnread.current = unread; if (unread === before) return;
      var fresh = readClick.current && Date.now() - readClick.current < 10000; if (unread < before) readClick.current = 0; /* una notifica nuova in mezzo non consuma il clic */
      if (fresh && unread < before) setLive([unread ? L.notifications + ', ' + unread + ' ' + (unread === 1 ? L.unreadOne : L.unread) : L.unreadNone, 'count']);
      else setLive(function (v) { return v[1] === 'count' ? ['', ''] : v; });
    }, [unread]);
    useEffect(function () { setLive([p.notificationsNotice || '', 'notice']); }, [p.notificationsNotice]); /* dopo quello del numero: se cambiano insieme vince l'avviso */
    /* aperto il pannello, il fuoco entra sulla linguetta scelta: una volta, qualunque cosa cambi dentro dopo (richiesta 87) */
    useEffect(function () { if (pop === 'notif' && notifRef.current) { var t = notifRef.current.querySelector('[role="tab"][aria-selected="true"]'); if (t) t.focus({ preventScroll: true }); } }, [pop]);
    var shown = tab === 'me' ? notes.filter(function (n) { return n.forMe !== false; }) : notes;
    var notifBody;
    if (nState === 'loading') notifBody = h('div', { className: 'zr-notif-state', role: 'status' }, h('span', { className: 'zr-visually-hidden' }, L.loading), h(Skeleton, { lines: 4 }));
    else if (nState === 'error') notifBody = h('div', { className: 'zr-notif-state', role: 'alert' }, h('p', null, L.notificationsError), p.onRetryNotifications ? h(Button, { variant: 'secondary', size: 'sm', icon: 'refresh', onClick: p.onRetryNotifications }, L.retry) : null);
    else if (!shown.length) notifBody = h(EmptyState, { compact: true, icon: 'bell', title: L.notificationsEmpty, text: L.notificationsEmptyText });
    else notifBody = h('ul', { className: 'zr-notif-list' }, shown.map(function (n) {
      return h('li', { key: n.id }, h(NotificationItem, { title: n.title, text: n.text, time: n.time, product: n.product, unread: n.unread, actor: n.actor, icon: n.icon, tone: n.tone, unreadLabel: L.unreadOne,
        onClick: function () { if (n.unread) readClick.current = Date.now(); setPop(null); if (p.onOpenNotification) p.onOpenNotification(n); } }));
    }));
    var notifPanel = pop === 'notif' ? h('div', { ref: notifRef, id: sid + '-notif', className: 'zr-pop zr-notif', role: 'dialog', 'aria-label': L.notifications },
      h('div', { className: 'zr-pop-head' }, /* testa e piede del pannello non sono punti di riferimento (richiesta 124) */
        h('h2', null, L.notifications, unread ? h('span', { className: 'zr-count' }, unread) : null),
        unread && p.onMarkAllRead ? h(Button, { variant: 'ghost', size: 'sm', onClick: function () { readClick.current = 0; p.onMarkAllRead(); } }, L.markAllRead) : null),
      /* le linguette: una fermata del Tab sola, frecce (in giro), Home e Fine scelgono; con Alt, Ctrl o Meta restano del browser; legate al pannello (richiesta 133) */
      h('div', { className: 'zr-notif-tabs', role: 'tablist', onKeyDown: function (e) {
        var keys = ['me', 'all'], at = keys.indexOf(tab), to = { ArrowRight: at + 1, ArrowLeft: at + keys.length - 1, Home: 0, End: keys.length - 1 }[e.key];
        if (to === undefined || e.altKey || e.ctrlKey || e.metaKey || !e.target.closest('[role="tab"]')) return;
        e.preventDefault(); to = to % keys.length; setTab(keys[to]); var b = e.currentTarget.querySelectorAll('[role="tab"]')[to]; if (b) b.focus();
      } },
        [['me', L.forMe], ['all', L.all]].map(function (t) { return h('button', { key: t[0], id: sid + '-tab-' + t[0], type: 'button', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', 'aria-controls': sid + '-notif-panel', tabIndex: tab === t[0] ? 0 : -1, className: cx('zr-tab', tab === t[0] && 'is-active'), onClick: function () { setTab(t[0]); } }, t[1]); })),
      h('div', { className: 'zr-pop-body', id: sid + '-notif-panel', role: 'tabpanel', 'aria-labelledby': sid + '-tab-' + tab }, notifBody),
      p.onAllNotifications ? h('div', { className: 'zr-pop-foot' }, h(Button, { variant: 'secondary', size: 'sm', icon: 'arrow', onClick: function () { setPop(null); p.onAllNotifications(); } }, L.seeAll)) : null) : null;

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
            : h('a', { key: 'c' + i, href: c.href || '#', onClick: function (e) { if (!c.href) e.preventDefault(); if (p.onCrumb) p.onCrumb(c, i, e); if (c.href && spa(e)) { e.preventDefault(); p.navigate(e.currentTarget.href); } } /* onCrumb con l'evento, poi navigate come la sidebar (richiesta 130) */ }, c.label)];
      })) : null;

    var settingsItem = { id: 'settings', label: L.settings, icon: 'settings', href: p.settingsHref };
    /* la barra dietro il selettore o il menu Moduli, e il piede, sono attenuati e inert (richiesta 110): l'attributo da un effetto, che React 18 non scrive inert */
    var behind = open || pop === 'ws', navRef = useRef(null), footRef = useRef(null);
    useEffect(function () { [navRef.current, footRef.current].forEach(function (el) { if (el) { if (behind) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } }); }, [behind]);
    /* l'area che scorre (il main, o col percorso il suo corpo; flush non scorre) è nel giro del Tab quando dentro niente prende il fuoco: chi usa la tastiera la fa scorrere (richiesta 30) */
    var hasCrumbs = !!crumbs;
    useEffect(function () {
      var m = mainRef.current; var el = m && (p.flush ? null : hasCrumbs ? m.querySelector(':scope > .zr-main-body') : m); if (!el) return;
      return scrollStop(el);
    }, [p.flush, hasCrumbs]);
    /* il pannello della ricerca, quando scorre, lo stesso: col fuoco su di lui la tastiera lo fa scorrere (richiesta 129) */
    useEffect(function () { var el = showPanel && searchRef.current && searchRef.current.querySelector(':scope > .zr-search-panel'); if (el) return scrollStop(el, true); }, [showPanel]);
    /* «Salta al contenuto» porta il fuoco al main: tabindex -1 solo per il salto, tolto quando il fuoco se ne va; un tabindex che ha già resta (richiesta 5) */
    function skipToMain(e) {
      e.preventDefault(); var m = mainRef.current; if (!m) return;
      if (!m.hasAttribute('tabindex')) { var off = function () { if (m.ownerDocument.activeElement !== m) { m.removeAttribute('tabindex'); m.removeEventListener('blur', off); } }; m.setAttribute('tabindex', '-1'); m.addEventListener('blur', off); }
      m.focus();
    }
    var kbd = IS_MAC ? '⌘K' : 'Ctrl K';
    var unreadText = unread > 99 ? '99+' : String(unread);

    return h('div', { className: cx('zr-shell', drawer && 'is-drawer', p.className) },
      h('a', { className: 'zr-btn zr-btn-secondary zr-btn-sm zr-skip', href: '#' + sid + '-main', onClick: skipToMain }, L.skipToContent),
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
        h('nav', { ref: navRef, className: cx('zr-nav', behind && 'is-dimmed'), 'aria-hidden': behind ? 'true' : undefined },
          groups.map(function (g) {
            return h('div', { key: g.group, className: cx('zr-nav-group', (g.products || (g.group === 'Prodotti' || g.group === 'Moduli')) && 'is-products') },
              h('div', { className: 'zr-nav-title' }, g.group),
              g.items.map(item));
          })),
        h('div', { ref: footRef, className: cx('zr-side-foot', behind && 'is-dimmed') },
          p.settings === false ? null : item(settingsItem),
          p.plan === false ? null : h('div', { className: 'zr-plan' },
            h('strong', null, L.planTitle),
            h('span', null, L.planText)))),
      h('header', { className: cx('zr-top', noSearch && 'no-search') },
        h('button', { type: 'button', className: 'zr-btn zr-btn-ghost zr-btn-md zr-top-menu', 'aria-label': drawer ? L.closeMenu : L.openMenu, 'aria-expanded': drawer ? 'true' : 'false', 'aria-controls': sid + '-side', onClick: function () { setDrawer(!drawer); setPop(null); } },
          h(Icon, { name: 'menu', size: 20 }), current ? h('span', { className: 'zr-top-product' }, current.label) : null),
        noSearch ? null : h('div', { ref: searchRef, className: cx('zr-search', showPanel && 'is-open'), onBlur: function (e) { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setPop(function (v) { return v === 'search' ? null : v; }); } /* il fuoco esce dalla ricerca: il pannello si chiude (richieste 7 e 90) */, onMouseDown: function (e) { if (e.target === e.currentTarget || (e.target.closest && e.target.closest('.zr-search-icon'))) { e.preventDefault(); if (inputRef.current) inputRef.current.focus(); setPop('search'); } } /* anche col fuoco già nel campo, chiuso con Esc: il tocco sull'icona lo riapre */ },
          h('span', { className: 'zr-search-icon' }, h(Icon, { name: 'search', size: 18 })),
          h('input', { ref: inputRef, type: 'search', value: q, placeholder: p.searchPlaceholder || L.searchPlaceholder, 'aria-label': L.search, role: 'combobox', 'aria-autocomplete': 'list',
            'aria-expanded': listOpen ? 'true' : 'false', 'aria-controls': listOpen ? sid + '-results' : undefined, 'aria-activedescendant': listOpen ? sid + '-r' + hi : undefined, 'aria-keyshortcuts': IS_MAC ? 'Meta+K' : 'Control+K', enterKeyHint: onSubmit ? 'search' : undefined,
            onFocus: function () { setPop('search'); }, onClick: function () { setPop('search'); } /* chiuso con Esc il fuoco resta: il clic lo riapre (richiesta 47) */, onChange: function (e) { runSearch(e.target.value); }, onKeyDown: searchKeys }),
          h('kbd', null, kbd),
          h('div', { className: 'zr-visually-hidden', role: 'status', 'aria-live': 'polite' }, countText),
          showPanel ? h('div', { className: 'zr-search-panel', role: 'group', 'aria-label': L.searchResults, onKeyDown: function (e) { if (e.key === 'Escape' && e.target === e.currentTarget) { e.preventDefault(); e.stopPropagation(); if (inputRef.current) inputRef.current.focus(); setPop(null); } } /* Esc dal pannello: si chiude e il fuoco torna al campo (richiesta 131) */ }, panelBody) : null),
        h('div', { className: 'zr-top-actions' },
          p.actions || null,
          h('button', { ref: bellRef, type: 'button', className: cx('zr-btn zr-btn-ghost zr-btn-md zr-btn-icon zr-bell', pop === 'notif' && 'is-active'), 'aria-label': L.notifications + (unread ? ', ' + unreadText + ' ' + (unread === 1 ? L.unreadOne : L.unread) : ''),
            'aria-expanded': pop === 'notif' ? 'true' : 'false', 'aria-controls': sid + '-notif',
            onClick: function () { var next = pop === 'notif' ? null : 'notif'; setPop(next); if (next && p.onNotificationsOpen) p.onNotificationsOpen(); } },
            h(Icon, { name: 'bell', size: 18 }), unread ? h('span', { className: cx('zr-bell-count', unreadText.length > 2 && 'is-wide'), 'aria-hidden': 'true' }, unreadText) : null),
          h('button', { ref: avatarRef, type: 'button', className: 'zr-avatar-btn', 'aria-label': L.account + ': ' + user, 'aria-haspopup': 'menu', 'aria-expanded': pop === 'profile' ? 'true' : 'false',
            onClick: function () { setPop(pop === 'profile' ? null : 'profile'); } }, h(Avatar, { name: user, src: p.userPhoto })),
          notifPanel,
          h('div', { className: 'zr-visually-hidden', role: 'status', 'aria-live': 'polite' }, live[0]), /* l'avviso letto ad alta voce, sempre montato (richiesta 14), o il numero sceso (richiesta 56) */
          pop === 'profile' ? h(Menu, { anchor: avatarRef.current, inline: true, label: L.account, items: profileItems, className: 'zr-profile-menu',
        head: h('div', { className: 'zr-profile-head' }, h(Avatar, { name: user, src: p.userPhoto, decorative: true }), h('span', null, h('strong', null, user), p.email ? h('span', null, p.email) : null, p.planName ? h('span', null, p.planName) : null)),
        onClose: function () { setPop(null); } }) : null)),
      h('main', { ref: mainRef, id: sid + '-main', className: cx('zr-main', p.flush && 'is-flush', crumbs && 'has-crumbs'), 'aria-label': L.mainContent },
        crumbs ? [h('div', { key: 'cb', className: 'zr-crumbbar' }, crumbs), h('div', { key: 'body', className: 'zr-main-body' }, p.children)] : p.children));
  }

  /* ---------- ProductTile ---------- */
  var PRODUCT_TILE_LABELS = { active: 'Attivo', soon: 'In arrivo', soonMeta: 'Ti avviseremo al lancio', open: 'Apri' };
  function ProductTile(p) {
    var L = Object.assign({}, PRODUCT_TILE_LABELS, p.labels || {});
    var soon = p.status === 'soon';
    var tone = p.tone || 'pine';
    var inner = [
      h('div', { key: 'hd', className: 'zr-tile-head' },
        h('span', { className: cx('zr-iconbox', 'zr-label-' + (soon ? 'neutral' : tone)) }, h(Icon, { name: p.icon || 'grid', size: 22 })),
        h(Label, { tone: soon ? 'neutral' : 'pine' }, soon ? L.soon : L.active)),
      h('div', { key: 'bd', className: 'zr-tile-body' },
        h('h3', { className: 'zr-tile-name' }, p.name),
        p.description ? h('p', { className: 'zr-tile-desc' }, p.description) : null),
      h('div', { key: 'ft', className: 'zr-tile-foot' },
        h('span', null, p.meta || (soon ? L.soonMeta : '')),
        soon ? null : h('span', { className: 'zr-tile-go' }, p.cta || L.open, h(Icon, { name: 'arrow', size: 16 })))
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

  /* ---------- KanbanCard ---------- */
  /* i testi della board nella lingua del modulo; il default è l'italiano (richiesta 149) */
  var KANBAN_TEXTS = { overdue: 'Scaduta · {date}', checklist: 'Checklist', comments: 'Commenti', wipLimit: 'Limite WIP {n}', overLimit: 'Oltre il limite', listActions: 'Azioni lista {title}', addCard: 'Aggiungi scheda', addList: 'Aggiungi lista', newList: 'Nuova lista', cardTitle: 'Titolo della scheda…', cardTitleLabel: 'Titolo della nuova scheda', add: 'Aggiungi', cancel: 'Annulla', cardActions: 'Azioni rapide', vote: 'Vota', unvote: 'Togli il voto', votes: '{n} voti', oneVote: '1 voto', voted: 'hai votato', crumbs: 'Percorso', board: 'Board', list: 'Lista', calendar: 'Calendario', filter: 'Filtra', share: 'Condividi' };
  function kanbanTexts(t) { var o = Object.assign({}, KANBAN_TEXTS); if (t) Object.keys(t).forEach(function (k) { if (t[k] != null) o[k] = t[k]; }); return o; } /* un testo undefined o null resta quello di default */
  function textOf(t, k, v) { return t.replace(k, function () { return v; }); } /* il testo del modulo entra com'è, anche con «$&» */
  function KanbanCard(p) {
    var T = kanbanTexts(p.texts);
    var cl = p.checklist;
    var done = cl && cl.total > 0 && cl.done >= cl.total;
    var ms = useState(false), menu = ms[0], btn = useRef(null), kb = useRef(false);
    var acts = p.actions && p.actions.length ? p.actions : null;
    var rest = omit(p, ['title', 'number', 'labels', 'due', 'overdue', 'checklist', 'comments', 'assignees', 'cover', 'dragging', 'className', 'texts', 'actions', 'actionsLabel', 'votes']);
    /* il voto anonimo della retrospettiva: quanti e «hai votato», il pulsante premuto; senza onToggle solo il numero (richiesta 170) */
    var vt = p.votes, vn = vt ? Math.max(0, vt.count || 0) : 0, vs = vt ? (vn === 1 ? T.oneVote : textOf(T.votes, '{n}', String(vn))) : '';
    var vote = !vt ? null : vt.onToggle ? h('button', { type: 'button', draggable: false, className: 'zr-card-vote', 'aria-pressed': vt.mine ? 'true' : 'false', 'aria-label': T.vote + ': ' + vs, title: vt.mine ? T.unvote : T.vote,
        onKeyDown: function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.stopPropagation(); if (e.repeat) e.preventDefault(); } }, /* Invio e Spazio sono del voto, non della scheda; tenuti premuti non votano a ripetizione. Gli altri tasti passano */
        onClick: function (e) { e.stopPropagation(); vt.onToggle(); } }, h(Icon, { name: vt.mine ? 'check' : 'chevronUp', size: 14 }), h('span', { 'aria-hidden': true }, vn))
      : h('span', { className: cx('zr-meta', vt.mine && 'is-voted'), title: vt.mine ? vs + ', ' + T.voted : vs }, h(Icon, { name: vt.mine ? 'check' : 'chevronUp', size: 14 }), h('span', { 'aria-hidden': true }, vn), h('span', { className: 'zr-visually-hidden' }, vt.mine ? vs + ', ' + T.voted : vs));
    /* il «⋯» delle azioni rapide: fuori dal Tab, si apre anche dalla scheda con «.», Maiusc+F10 o il tasto Menu (richiesta 157) */
    if (acts) rest.onKeyDown = function (e) {
      if (e.target === e.currentTarget && (e.key === '.' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); kb.current = true; ms[1](true); return; }
      if (p.onKeyDown) p.onKeyDown(e);
    };
    /* il menu sta accanto alla scheda, non dentro: un clic su una voce non apre la scheda */
    var card = h('article', Object.assign({ tabIndex: 0, 'aria-keyshortcuts': acts ? '. Shift+F10' : undefined }, rest, { className: cx('zr-card', p.dragging && 'is-dragging', acts && 'has-actions', p.className) }),
      acts ? h('button', { ref: btn, type: 'button', tabIndex: -1, draggable: false, className: 'zr-card-actions', 'aria-label': p.actionsLabel || T.cardActions, 'aria-haspopup': 'menu', 'aria-expanded': menu,
        onMouseDown: function (e) { e.stopPropagation(); }, onClick: function (e) { e.stopPropagation(); kb.current = false; ms[1](!menu); } }, h(Icon, { name: 'more', size: 16 })) : null,
      p.cover ? h('div', { className: cx('zr-card-cover', 'zr-cover-' + p.cover) }) : null,
      p.labels && p.labels.length ? h('div', { className: 'zr-card-labels' }, p.labels.map(function (l, i) { return h(Label, { key: i, tone: l.tone }, l.text); })) : null,
      h('h4', { className: 'zr-card-title' }, p.number != null && p.number !== '' ? h('span', { className: 'zr-card-num' }, '#' + p.number + ' ') : null, p.title), /* il numero della scheda davanti al titolo, in grigio: per cercarla e citarla (richiesta 209) */
      (p.due || cl || p.comments || vote || (p.assignees && p.assignees.length)) ? h('div', { className: 'zr-card-meta' },
        p.due ? h('span', { className: cx('zr-meta', p.overdue && 'is-overdue') }, h(Icon, { name: p.overdue ? 'clock' : 'calendar', size: 14 }), p.overdue ? textOf(T.overdue, '{date}', p.due) : p.due) : null,
        cl ? h('span', { className: cx('zr-meta', done && 'is-done'), title: T.checklist }, h(Icon, { name: 'checklist', size: 14 }), cl.done + '/' + cl.total) : null,
        p.comments ? h('span', { className: 'zr-meta', title: T.comments }, h(Icon, { name: 'message', size: 14 }), p.comments) : null,
        vote,
        p.assignees && p.assignees.length ? h('span', { className: 'zr-card-people' }, h(AvatarStack, { people: p.assignees, max: 3 })) : null) : null);
    return acts ? h(React.Fragment, null, card, menu ? h(Menu, { anchor: btn.current, align: 'end', label: p.actionsLabel || T.cardActions, items: acts, onClose: function () { ms[1](false); var a = kb.current && btn.current && btn.current.parentNode, b = btn.current; if (a) queueMicrotask(function () { var x = document.activeElement; if (document.contains(a) && (!x || x === document.body || x === b)) a.focus(); }); } }) : null) : card; /* aperto dalla scheda con la tastiera, il fuoco torna alla scheda (dopo quello che il Menu rende al «⋯»), se la voce scelta non l'ha portato altrove */
  }

  /* ---------- KanbanColumn ---------- */
  function KanbanColumn(p) {
    var count = p.count != null ? p.count : React.Children.count(p.children);
    var over = p.limit && count > p.limit;
    var T = kanbanTexts(p.texts);
    var rest = omit(p, ['title', 'count', 'limit', 'children', 'onAdd', 'isOver', 'composer', 'className', 'texts']);
    return h('section', Object.assign({}, rest, { className: cx('zr-col', p.isOver && 'is-over', p.className), 'aria-label': p.title }),
      h('header', { className: 'zr-col-head' },
        h('h3', null, p.title),
        h('span', { className: cx('zr-count', over && 'is-over'), title: p.limit ? textOf(T.wipLimit, '{n}', p.limit) : undefined }, p.limit ? count + '/' + p.limit : count),
        over ? h('span', { className: 'zr-col-warn' }, T.overLimit) : null,
        h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': textOf(T.listActions, '{title}', p.title) })),
      h('div', { className: 'zr-col-body' }, p.children),
      p.composer || h('button', { type: 'button', className: 'zr-col-add', onClick: p.onAdd }, h(Icon, { name: 'plus', size: 16 }), h('span', null, T.addCard)));
  }

  /* ---------- AddList: «Aggiungi lista» tratteggiato, anche fuori dalla KanbanBoard (richiesta 148) ---------- */
  function AddList(p) {
    var rest = omit(p, ['label', 'className']);
    return h('button', Object.assign({ type: 'button' }, rest, { className: cx('zr-add-list', p.className) }), h(Icon, { name: 'plus', size: 18 }), h('span', null, p.label || KANBAN_TEXTS.addList));
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
    var C = useLabels(), T = kanbanTexts(p.texts);
    if (!p.texts || p.texts.add == null) T.add = C.add; /* «Aggiungi» e «Annulla» del riquadro di scrittura nella lingua dell'app, se il modulo non li passa (richiesta 186) */
    if (!p.texts || p.texts.cancel == null) T.cancel = C.cancel;
    var votes = {}; (p.lists || []).forEach(function (l) { (l.cards || []).forEach(function (c) { if (c.votes) votes[c.id] = c.votes; }); }); /* i voti seguono le liste che il modulo ripassa: la board le copia una volta sola (richiesta 170) */
    var st = useState(function () { return (p.lists || SAMPLE_LISTS).map(function (l) { return Object.assign({}, l, { cards: (l.cards || []).map(function (c) { return Object.assign({}, c); }) }); }); }); /* copia che tiene le funzioni delle actions (non JSON) */
    var lists = st[0], setLists = st[1];
    var ov = useState(null), overId = ov[0], setOverId = ov[1];
    var dg = useState(null), dragId = dg[0], setDragId = dg[1];
    var ad = useState(null), addingIn = ad[0], setAddingIn = ad[1];
    var tx = useState(''), draft = tx[0], setDraft = tx[1];
    var vw = useState('board'), view = vw[0], setView = vw[1];
    var seq = useRef(100);

    function withVotes(c) { return p.lists ? Object.assign({}, c, { votes: votes[c.id] }) : c; } /* con le liste del modulo i voti sono i suoi di adesso, non quelli della copia */
    function commit(next) { setLists(next); if (p.onChange) p.onChange(p.lists ? next.map(function (l) { return Object.assign({}, l, { cards: l.cards.map(withVotes) }); }) : next); }
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
      commit(lists.concat([{ id: 'l' + seq.current, title: T.newList, cards: [] }]));
    }

    var views = [['board', T.board, 'board'], ['list', T.list, 'list'], ['calendar', T.calendar, 'calendar']];

    return h('div', { className: 'zr-board' },
      h('header', { className: 'zr-board-head' },
        p.crumbs === false ? null : h('nav', { className: 'zr-crumbs', 'aria-label': T.crumbs },
          h('a', { href: '#' , onClick: function (e) { e.preventDefault(); } }, p.product || 'Board'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('a', { href: '#', onClick: function (e) { e.preventDefault(); } }, p.folder || 'Corsi 2026'),
          h(Icon, { name: 'chevron', size: 14 }),
          h('span', { 'aria-current': 'page' }, p.title || 'Lancio corso Leadership')),
        h('div', { className: 'zr-board-titlebar' },
          h('h1', { className: 'zr-board-title' }, p.title || 'Lancio corso Leadership'),
          h('div', { className: 'zr-board-actions' },
            h(AvatarStack, { people: p.members || ['Luciano Castro', 'Giulia Bianchi', 'Marco Neri', 'Costanza Rossi'], max: 3 }),
            h(Button, { variant: 'secondary', size: 'sm', icon: 'filter' }, T.filter),
            h(Button, { variant: 'primary', size: 'sm', icon: 'share' }, T.share))),
        h('div', { className: 'zr-tabs', role: 'tablist' },
          views.map(function (v) {
            return h('button', { key: v[0], type: 'button', role: 'tab', 'aria-selected': view === v[0], className: cx('zr-tab', view === v[0] && 'is-active'), onClick: function () { setView(v[0]); } }, h(Icon, { name: v[2], size: 16 }), v[1]);
          }))),
      h('div', { className: 'zr-lanes' },
        lists.map(function (l) {
          var composer = addingIn === l.id ? h('div', { className: 'zr-composer' },
            h('textarea', {
              autoFocus: true, rows: 2, value: draft, placeholder: T.cardTitle, 'aria-label': T.cardTitleLabel,
              onChange: function (e) { setDraft(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(l.id); } if (e.key === 'Escape') { setAddingIn(null); setDraft(''); } }
            }),
            h('div', { className: 'zr-composer-row' },
              h(Button, { size: 'sm', onClick: function () { addCard(l.id); } }, T.add),
              h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': p.closeLabel || T.cancel, onClick: function () { setAddingIn(null); setDraft(''); } }))) : null;
          return h(KanbanColumn, {
            key: l.id, title: l.title, count: l.cards.length, limit: l.limit, isOver: overId === l.id && dragId != null, texts: p.texts,
            composer: composer, onAdd: function () { setAddingIn(l.id); setDraft(''); },
            onDragOver: function (e) { e.preventDefault(); if (overId !== l.id) setOverId(l.id); },
            onDragLeave: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); },
            onDrop: function (e) { e.preventDefault(); if (dragId) move(dragId, l.id, null); setOverId(null); setDragId(null); }
          }, l.cards.map(function (c) {
            return h(KanbanCard, Object.assign({ key: c.id, texts: p.texts }, c, {
              votes: p.lists ? votes[c.id] : c.votes, draggable: true, dragging: dragId === c.id,
              onDragStart: function (e) { setDragId(c.id); try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} },
              onDragEnd: function () { setDragId(null); setOverId(null); },
              onDrop: function (e) { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== c.id) move(dragId, l.id, c.id); setOverId(null); setDragId(null); },
              onClick: p.onOpenCard ? function () { p.onOpenCard(withVotes(c)); } : undefined
            }));
          }));
        }),
        h(AddList, { label: T.addList, onClick: addList })));
  }

  /* ---------- DashboardHome ---------- */
  var SAMPLE_PRODUCTS = [
    { id: 'pm', name: 'Board', icon: 'board', tone: 'pine', description: 'Board Kanban in aree: organizza attività, scadenze e persone.', meta: '2 aree · 5 board' },
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
          h('h2', { className: 'zr-home-h2' }, 'Aree recenti'),
          h(Button, { variant: 'ghost', size: 'sm', icon: 'folder' }, 'Tutte le aree')),
        h('div', { className: 'zr-grid-2' }, folders.map(function (f) { return h(ProjectFolder, Object.assign({ key: f.name }, f)); }))));
  }

  /* =====================  HOMEPAGE (sito pubblico)  ===================== */
  var SITE_NAV = [
    { label: 'Prodotti', href: '#prodotti' },
    { label: 'Settori', href: '#settori' },
    { label: 'Come funziona', href: '#come-funziona' },
    { label: 'Prezzi', href: '#prezzi' },
    { label: 'FAQ', href: '#faq' }
  ];

  var SITE_HEADER_LABELS = { login: 'Accedi', signup: 'Inizia gratis', openMenu: 'Apri menu', closeMenu: 'Chiudi menu', nav: 'Sito', home: 'Zeiras, pagina iniziale', language: 'Lingua' };
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

  /* ---------- Breadcrumb: percorso delle pagine pubbliche ---------- */
  function Breadcrumb(p) {
    var items = p.items || [{ label: 'Zeiras', href: '/it/' }, { label: 'Settori', href: '/it/settori/' }, { label: 'Palestre e personal trainer' }];
    return h('nav', { className: cx('zr-breadcrumb', p.className), 'aria-label': p.label || 'Percorso' },
      h('ol', null, items.map(function (it, i) {
        var last = i === items.length - 1;
        return h('li', { key: i },
          last || !it.href ? h('span', { 'aria-current': last ? 'page' : undefined }, it.label) : h('a', { href: it.href }, it.label),
          last ? null : h(Icon, { name: 'chevron', size: 14 }));
      })));
  }

  var HERO_PREVIEW = { title: 'Lancio corso · Board', lanes: [
    { title: 'Da fare', cards: [{ title: 'Definire gli obiettivi', labels: [{ text: 'Strategia', tone: 'plum' }], due: '3 ott', assignees: ['Luciano Castro'] }, { title: 'Raccogliere testimonianze', labels: [{ text: 'Marketing', tone: 'sky' }], comments: 2 }] },
    { title: 'In corso', cards: [{ title: 'Scaletta del modulo 2', cover: 'citrus', labels: [{ text: 'Contenuti', tone: 'citrus' }], checklist: { done: 3, total: 5 }, assignees: ['Giulia Bianchi', 'Marco Neri'] }] },
    { title: 'Fatto', cards: [{ title: 'Titolo del corso', checklist: { done: 2, total: 2 } }] }
  ] };
  function HeroPreview(p) {
    var pv = p.preview || HERO_PREVIEW;
    return h('div', { className: 'zr-hero-shot', 'aria-hidden': true },
      h('div', { className: 'zr-hero-shot-bar' }, h('i'), h('i'), h('i'), h('span', null, pv.title)),
      h('div', { className: 'zr-hero-shot-lanes' },
        (pv.lanes || []).map(function (ln, i) {
          return h('div', { key: i, className: 'zr-hero-lane' }, h('div', { className: 'zr-hero-lane-t' }, ln.title),
            (ln.cards || []).map(function (c, j) { return h(KanbanCard, Object.assign({ key: j, tabIndex: -1 }, c)); }));
        })));
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
        p.visual || h(HeroPreview, { preview: p.preview })));
  }

  function SectionHeading(p) {
    return h('div', { className: cx('zr-sec-head', p.align === 'center' && 'is-center', p.level === 1 && 'is-page') },
      p.overline ? h('span', { className: 'zr-overline' }, p.overline) : null,
      h(p.level === 1 ? 'h1' : 'h2', { className: 'zr-sec-title' }, p.title),
      p.subtitle ? h('p', { className: 'zr-sec-sub' }, p.subtitle) : null);
  }

  function StepList(p) {
    var steps = p.steps || [
      { title: 'Iscriviti', text: 'Email o Google, nessuna carta. Il tuo spazio di lavoro è pronto subito.', icon: 'users' },
      { title: 'Crea un\'area', text: 'Una per progetto o ambito: lavoro, clienti, casa, studio.', icon: 'folder' },
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
      { title: 'Agenzie', text: 'Una board per cliente, tutte in un\'area.' },
      { title: 'Associazioni', text: 'Volontari ed eventi coordinati senza fatica.' },
      { title: 'Studi professionali', text: 'Pratiche e adempimenti visibili a tutto lo studio.' }
    ];
    return h('ul', { className: 'zr-audience' }, items.map(function (a, i) {
      return h('li', { key: i }, h('h3', null, a.title), h('p', null, a.text));
    }));
  }

  var PRICING_LABELS = { soon: 'In arrivo', soonCta: 'In arrivo', cta: 'Inizia gratis' };
  /* ---------- SectorGrid: le verticalizzazioni, ognuna con la sua pagina ---------- */
  var SAMPLE_SECTORS = [
    { title: 'Palestre e personal trainer', text: 'Dalla prova all’iscrizione, ingressi scalati con un tocco, certificati e rinnovi.', icon: 'target', tone: 'pine', tags: ['Iscritti', 'Abbonamenti', 'Check-in'], href: '#palestre' },
    { title: 'Architetti, geometri e ingegneri', text: 'Richieste, incarichi a fasi legati all’immobile e pratiche con i loro termini.', icon: 'building', tone: 'sky', tags: ['Incarichi', 'Immobili', 'Pratiche'], href: '#tecnici' },
    { title: 'Liberi professionisti', text: 'Primo colloquio, incarichi o percorsi, sedute e ore scalate da pacchetti.', icon: 'user', tone: 'citrus', tags: ['Clienti', 'Sedute', 'Scadenze'], href: '#professionisti' },
    { title: 'Agenzie digitali', text: 'Lead, brief e proposte, contratti con ore a consumo e asset dei clienti.', icon: 'megaphone', tone: 'plum', tags: ['Proposte', 'Contratti', 'Rinnovi'], href: '#agenzie' },
    { title: 'PMI di servizi', text: 'Sopralluoghi, offerte, contratti con canone, interventi e rapportini.', icon: 'settings', tone: 'pine', tags: ['Offerte', 'Interventi', 'Impianti'], href: '#pmi' },
    { title: 'Scuole di formazione', text: 'Candidature, iscrizioni a edizioni con posti e rate, presenze e attestati.', icon: 'checklist', tone: 'sky', tags: ['Corsisti', 'Edizioni', 'Attestati'], href: '#formazione' }
  ];
  function SectorGrid(p) {
    var items = p.items || SAMPLE_SECTORS;
    return h('ul', { className: 'zr-sectors' }, items.map(function (x, i) {
      var inner = [
        h('span', { key: 'i', className: cx('zr-iconbox', 'zr-label-' + (x.tone || 'pine')) }, h(Icon, { name: x.icon || 'grid', size: 22 })),
        h('h3', { key: 't' }, x.title),
        x.text ? h('p', { key: 'x' }, x.text) : null,
        x.tags && x.tags.length ? h('div', { key: 'g', className: 'zr-sector-tags' }, x.tags.map(function (t) { return h(Label, { key: t, tone: 'neutral' }, t); })) : null,
        x.href ? h('span', { key: 'c', className: 'zr-tile-go' }, x.cta || p.cta || 'Scopri', h(Icon, { name: 'arrow', size: 16 })) : null
      ];
      return h('li', { key: x.href || i }, x.href ? h('a', { className: 'zr-sector', href: x.href }, inner) : h('div', { className: 'zr-sector' }, inner));
    }));
  }

  function PricingCard(p) {
    var L = Object.assign({}, PRICING_LABELS, p.labels || {});
    var soon = p.status === 'soon';
    return h('article', { className: cx('zr-price', p.featured && 'is-featured', soon && 'is-soon') },
      h('header', null,
        h('div', { className: 'zr-price-top' }, h('h3', null, p.name), soon ? h(Label, null, L.soon) : (p.badge ? h(Label, { tone: 'pine' }, p.badge) : null)),
        h('p', { className: 'zr-price-desc' }, p.description)),
      h('div', { className: 'zr-price-amount' }, h('strong', null, p.price), p.period ? h('span', null, p.period) : null),
      h('ul', { className: 'zr-price-list' }, (p.features || []).map(function (f, i) {
        return h('li', { key: i }, h(Icon, { name: 'checklist', size: 16 }), h('span', null, f));
      })),
      soon ? h('button', { type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-md', disabled: true }, p.cta || L.soonCta)
        : h('a', { href: p.href || '#', className: cx('zr-btn', 'zr-btn-md', p.featured ? 'zr-btn-primary' : 'zr-btn-secondary') }, p.cta || L.cta));
  }

  function FAQ(p) {
    var items = p.items || [
      { q: 'Qual è il trucco?', a: 'Nessuno. Per i progetti personali Zeiras è gratis per sempre, senza limiti di board, liste o schede.' },
      { q: 'Serve una carta di credito per iscriversi?', a: 'No. Basta un indirizzo email o un account Google.' },
      { q: 'Quali prodotti sono disponibili oggi?', a: 'Board, con board Kanban e Gantt. CRM, Report, Automazioni e Contenuti AI sono in arrivo e si attiveranno nello stesso spazio di lavoro.' },
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
    name: 'Castro & Partners', legalForm: 'S.r.l.', address: 'Via Margaritone 30, 52100 Arezzo (AR), Italia', vat: '02453920510', taxCode: null, registry: 'Arezzo-Siena',
    capital: '40.000 €', pec: 'castroandpartners@pec.it', email: 'contatti@castroandpartners.com', phone: '+39 0575 146 0000'
  };
  var SITE_FOOTER_LABELS = { tagline: 'La suite semplice e gratuita per organizzare il tuo lavoro.', by: 'Sviluppato da', registeredOffice: 'Sede legale', vat: 'P. IVA', vatTax: 'P. IVA e C.F.', taxCode: 'C.F.', rea: 'REA', registry: 'Registro delle Imprese', registryNo: 'n.', capital: 'Capitale sociale', paidUp: 'i.v.', pec: 'PEC', email: 'Email', phone: 'Tel.', rights: 'Tutti i diritti riservati.', legalNav: 'Informazioni legali', missing: 'Dato da inserire', language: 'Lingua', soon: 'In arrivo' };
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

  function LandingPage(p) {
    var products = p.products || [
      { id: 'pm', name: 'Board', icon: 'board', tone: 'pine', description: 'Board Kanban e Gantt: ogni attività ha un responsabile e una scadenza.' },
      { id: 'crm', name: 'CRM', icon: 'users', tone: 'sky', description: 'Ogni cliente e ogni trattativa con il passo successivo.' },
      { id: 'bookings', name: 'Bookings', icon: 'calendar', tone: 'sky', description: 'I clienti prenotano da soli: slot, posti, conferme e promemoria.' },
      { id: 'reports', name: 'Report', icon: 'chart', tone: 'citrus', description: 'I numeri che contano, aggiornati da soli.' },
      { id: 'automations', name: 'Automazioni', icon: 'bolt', tone: 'plum', description: 'Promemoria, email e passaggi ripetitivi partono da soli.' },
      { id: 'content', name: 'Contenuti', icon: 'sparkle', tone: 'coral', description: 'Post, email e testi scritti con l’AI nel tuo stile.' },
      { id: 'cashflow', name: 'Flusso di cassa', icon: 'euro', tone: 'citrus', description: 'Entrate, uscite e previsioni di cassa.' },
      { id: 'marketing', name: 'Marketing', icon: 'megaphone', tone: 'plum', description: 'Campagne, liste e risultati in un posto.' },
      { id: 'collaboration', name: 'Area di collaborazione', icon: 'message', tone: 'sky', description: 'File, messaggi e approvazioni con clienti e collaboratori.' },
      { id: 'integrations', name: 'Integrazioni', icon: 'link', tone: 'pine', description: 'Collega Zeiras alle tue app con Zapier e Make.' }
    ];
    var plans = p.plans || [
      { name: 'Personale', badge: 'Per sempre', featured: true, price: '0 €', period: '/ mese', description: 'Per te e i tuoi progetti. Nessuna scadenza.', features: ['Tutti i 10 prodotti', 'Board, liste e schede illimitate', 'Il modello del tuo settore incluso'], cta: 'Crea il tuo spazio gratis' },
      { name: 'Business', badge: 'A pagamento', price: 'Su misura', description: 'Il piano a pagamento per aziende, studi, scuole e palestre che lavorano insieme.', features: ['Le stesse board, modificate insieme', 'Workspace del team, ruoli e permessi', 'Supporto dedicato e avvio guidato'], cta: 'Contattaci', href: '#contatti' }
    ];
    return h('div', { className: 'zr-site' },
      h(SiteHeader, { signupHref: p.signupHref, loginHref: p.loginHref }),
      h('main', null,
        h(Hero, { signupHref: p.signupHref }),
        h('section', { id: 'prodotti', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'La suite', title: '10 strumenti. Un solo accesso. Zero euro.', subtitle: 'Tutto quello che ti serve per vendere, organizzare e incassare, già collegato.' }),
          h('div', { className: 'zr-grid-3', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' } }, products.map(function (x) { return h(ProductTile, Object.assign({ key: x.id, cta: 'Prova gratis' }, x, { href: x.status === 'soon' ? undefined : (p.signupHref || '#') })); })))),
        h('section', { id: 'come-funziona', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Come funziona', title: 'Operativo in tre passi' }),
          h(StepList, null))),
        h('section', { id: 'prezzi', className: 'zr-sec' }, h('div', { className: 'zr-site-wrap' },
          h(SectionHeading, { overline: 'Prezzi', title: '0 €. Per sempre.', subtitle: 'Non è una prova: per i tuoi progetti Zeiras resta gratis. Paghi solo la versione Business, per lavorare in team.', align: 'center' }),
          h('div', { className: 'zr-prices' }, plans.map(function (x) { return h(PricingCard, Object.assign({ key: x.name, href: x.href || p.signupHref }, x)); })))),
        h('section', { id: 'faq', className: 'zr-sec zr-sec-alt' }, h('div', { className: 'zr-site-wrap zr-faq-wrap' },
          h(SectionHeading, { overline: 'Domande frequenti', title: 'Le risposte prima delle domande' }),
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
  var MONEY = {};
  function fmtMoney(v, cur) { if (!cur || cur === 'EUR') return EUR.format(v); try { if (!MONEY[cur]) MONEY[cur] = new Intl.NumberFormat('it-IT', { style: 'currency', currency: cur, maximumFractionDigits: 0 }); return MONEY[cur].format(v); } catch (e) { return EUR.format(v); } }
  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }

  /* ---------- Form ---------- */
  function Field(p) {
    var id = useId('fld');
    var as = p.as || (p.options ? 'select' : 'input');
    var rest = omit(p, ['label', 'hint', 'error', 'as', 'options', 'className', 'icon', 'children', 'required', 'counter']);
    var desc = p.error || p.hint ? id + '-d' : undefined;
    /* counter: quanti caratteri (per code point, come il server) su quanti, da una soglia in su; al limite lo si annuncia (richiesta 55) */
    var cnt = p.counter && p.counter.max ? p.counter : null;
    var cs = useState(function () { return String(p.value != null ? p.value : p.defaultValue != null ? p.defaultValue : ''); });
    var n = cnt ? Array.from(p.value != null ? String(p.value) : cs[0]).length : 0;
    var cid = cnt && n >= (cnt.from || 0) ? id + '-c' : undefined;
    if (cnt) { rest.onChange = function (e) { cs[1](e.target.value); if (p.onChange) p.onChange(e); }; desc = cx(desc, cid) || undefined; }
    /* non controllato: form.reset() cambia il valore senza onChange, e il contatore lo rilegge dal campo */
    useEffect(function () { var el = cnt && p.value == null && document.getElementById(id), f = el && el.form; if (!f) return; function back() { setTimeout(function () { cs[1](el.value); }, 0); } f.addEventListener('reset', back); return function () { f.removeEventListener('reset', back); }; }, [!!cnt, p.value == null]);
    var control;
    if (p.children) control = p.children;
    else if (as === 'select') control = h('div', { className: 'zr-select' }, h('select', Object.assign({ id: id, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest),
      p.options.map(function (o) { var v = typeof o === 'string' ? o : o.value; return h('option', { key: v, value: v }, typeof o === 'string' ? o : o.label); })), h(Icon, { name: 'chevronDown', size: 16 }));
    else if (as === 'textarea') control = h('textarea', Object.assign({ id: id, rows: 4, 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest));
    else control = h('div', { className: cx('zr-input', p.icon && 'has-icon') }, p.icon ? h(Icon, { name: p.icon, size: 16 }) : null,
      h('input', Object.assign({ id: id, type: 'text', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined, required: p.required }, rest)));
    var mid = p.error || p.hint ? id + '-d' : undefined;
    var msg = p.error ? h('p', { id: mid, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
      : p.hint ? h('p', { id: mid, className: 'zr-field-msg' }, p.hint) : null;
    return h('div', { className: cx('zr-field', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      control,
      cnt ? h('div', { className: 'zr-field-foot' }, msg,
        cid ? h('span', { id: cid, className: cx('zr-field-count', n === cnt.max && 'is-full', n > cnt.max && 'is-over') }, n + '/' + cnt.max) : null,
        h('span', { className: 'zr-visually-hidden', 'aria-live': 'polite' }, n >= cnt.max ? (cnt.full || 'Limite raggiunto: {max} caratteri').replace('{max}', function () { return cnt.max; }) : '')) : msg);
  }

  /* ---------- MentionField: scegliere un cliente del CRM scrivendo @nome ---------- */
  /* ---------- AddressField: indirizzo con autocompletamento (Google Places) ---------- */
  var ADDRESS_LABELS = { results: 'Suggerimenti', empty: 'Nessun suggerimento: puoi salvare il testo com’è', hint: 'Scrivi una città o un indirizzo completo', attribution: 'Suggerimenti di Google', city: 'Città', address: 'Indirizzo', freeText: 'Testo libero, non verificato', clear: 'Cancella l’indirizzo' };
  function AddressField(p) {
    var id = useId('adr');
    var L = Object.assign({}, ADDRESS_LABELS, p.labels || {});
    var ctrl = p.value !== undefined;
    var vs = useState(p.defaultValue || ''), text = ctrl ? (p.value || '') : vs[0];
    var ps = useState(p.defaultPlace || null), place = p.place !== undefined ? p.place : ps[0];
    var os = useState(!!p.defaultOpen), open = p.open !== undefined ? p.open : os[0];
    var as = useState(0), active = as[0];
    var q = text.trim().toLowerCase();
    var list = q.length < (p.minChars || 2) || (place && place.label === text) ? [] : (p.suggestions || []).filter(function (s) {
      if (p.onQuery) return true;
      return [s.main, s.secondary].filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
    }).slice(0, p.maxResults || 4);
    var showList = open && q.length >= (p.minChars || 2) && !(place && place.label === text);
    function setText(t) { if (!ctrl) vs[1](t); if (p.onChange) p.onChange(t); if (p.onQuery) p.onQuery(t); if (p.place === undefined) ps[1](null); if (p.onSelect && place) p.onSelect(null); if (p.open === undefined) os[1](true); as[1](0); }
    function pick(s) {
      var label = [s.main, s.secondary].filter(Boolean).join(', ');
      var pl = Object.assign({}, s, { label: label });
      if (!ctrl) vs[1](label); if (p.onChange) p.onChange(label);
      if (p.place === undefined) ps[1](pl); if (p.onSelect) p.onSelect(pl);
      if (p.open === undefined) os[1](false);
    }
    function onKey(e) {
      if (!showList || !list.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); as[1]((active + 1) % list.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); as[1]((active - 1 + list.length) % list.length); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(list[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); if (p.open === undefined) os[1](false); }
    }
    var desc = id + '-d';
    var status = place ? (place.kind === 'citta' ? L.city : L.address) + ' · ' + place.label : (text.trim() && !showList ? L.freeText : '');
    return h('div', { className: cx('zr-field', 'zr-address', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-mention-anchor' },
        h('label', { className: 'zr-input has-icon zr-address-box' }, h(Icon, { name: place ? 'checkCircle' : 'search', size: 16 }),
          h('input', { id: id, type: 'text', value: text, placeholder: p.placeholder || 'Es. Arezzo oppure Via Roma 4, Arezzo', autoComplete: 'off', role: 'combobox',
            'aria-expanded': showList, 'aria-controls': id + '-l', 'aria-autocomplete': 'list', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined,
            'aria-activedescendant': showList && list.length ? id + '-o' + active : undefined,
            onChange: function (e) { setText(e.target.value); }, onKeyDown: onKey, onFocus: function () { if (p.open === undefined) os[1](true); },
            onBlur: function () { if (p.open === undefined) setTimeout(function () { os[1](false); }, 120); } }),
          text ? h('button', { type: 'button', className: 'zr-mention-x', 'aria-label': L.clear, onClick: function () { setText(''); } }, h(Icon, { name: 'close', size: 14 })) : null),
        showList ? h('ul', { id: id + '-l', role: 'listbox', className: 'zr-mention-list zr-address-list', 'aria-label': L.results },
          list.map(function (s, i) {
            return h('li', { key: s.id, id: id + '-o' + i, role: 'option', 'aria-selected': i === active, className: cx('zr-mention-opt', i === active && 'is-active'),
              onMouseDown: function (e) { e.preventDefault(); pick(s); }, onMouseEnter: function () { as[1](i); } },
              h('span', { className: 'zr-address-ico', 'aria-hidden': true }, h(Icon, { name: s.kind === 'citta' ? 'globe' : 'home', size: 16 })),
              h('span', { className: 'zr-mention-opt-text' }, h('strong', null, s.main), s.secondary ? h('span', null, s.secondary) : null),
              h(Label, { tone: s.kind === 'citta' ? 'sky' : 'neutral' }, s.kind === 'citta' ? L.city : L.address));
          }),
          !list.length ? h('li', { className: 'zr-mention-empty', role: 'option', 'aria-disabled': true }, L.empty) : null,
          p.attribution !== false ? h('li', { className: 'zr-address-attr', role: 'presentation', 'aria-hidden': true }, L.attribution) : null) : null),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : h('p', { id: desc, className: cx('zr-field-msg', place && 'zr-address-ok') }, status || p.hint || L.hint));
  }

  var MENTION_LABELS = { remove: 'Togli', create: 'Crea «{q}» nel CRM', empty: 'Nessun cliente con questo nome', hint: 'Scrivi @ e il nome per scegliere un cliente del CRM', results: 'Clienti del CRM' };
  function MentionField(p) {
    var id = useId('mnt');
    var L = Object.assign({}, MENTION_LABELS, p.labels || {});
    var ctrlVal = p.value !== undefined;
    var vs = useState(p.defaultValue || []), values = ctrlVal ? p.value : vs[0];
    var ts = useState(p.defaultQuery != null ? '@' + p.defaultQuery : ''), text = p.query != null ? '@' + p.query : ts[0];
    var os = useState(!!p.defaultOpen), open = p.open !== undefined ? p.open : os[0];
    var as = useState(0), active = as[0];
    var multiple = p.multiple !== false;
    var at = text.lastIndexOf('@');
    var q = at >= 0 ? text.slice(at + 1).trim().toLowerCase() : null;
    var taken = values.map(function (v) { return v.id; });
    var list = q === null ? [] : (p.suggestions || []).filter(function (s) {
      if (taken.indexOf(s.id) >= 0) return false;
      if (p.filter === false) return true;
      var hay = [s.name, s.email, s.phone, s.sub].filter(Boolean).join(' ').toLowerCase();
      return !q || hay.indexOf(q) >= 0;
    }).slice(0, p.maxResults || 8);
    var canCreate = !!(p.onCreate || p.createLabel) && q;
    var count = list.length + (canCreate ? 1 : 0);
    var lk = list.map(function (x) { return x.id; }).join('\n'), pk = useState(lk); /* risultati nuovi (anche dal server, con filter={false}): l'opzione attiva torna la prima */
    if (pk[0] !== lk) { pk[1](lk); if (active) as[1](0); }
    if (active >= count && count) active = 0;
    var showList = open && q !== null;
    function setText(t) { if (p.query == null) ts[1](t); var i = t.lastIndexOf('@'); if (p.onQuery) p.onQuery(i >= 0 ? t.slice(i + 1) : null); if (p.open === undefined) os[1](i >= 0); as[1](0); }
    function setValues(v) { if (!ctrlVal) vs[1](v); if (p.onChange) p.onChange(v); }
    function pick(s) { setValues(multiple ? values.concat([s]) : [s]); setText(at >= 0 ? text.slice(0, at) : ''); if (p.open === undefined) os[1](false); }
    function create() { var name = text.slice(at + 1).trim(); if (p.onCreate) p.onCreate(name); setText(text.slice(0, at)); }
    function remove(v) { setValues(values.filter(function (x) { return x.id !== v.id; })); }
    function onKey(e) {
      if (e.key === 'Backspace' && !text && values.length) { remove(values[values.length - 1]); return; }
      if (!showList || !count) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); as[1]((active + 1) % count); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); as[1]((active - 1 + count) % count); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active < list.length) pick(list[active]); else create(); }
      else if (e.key === 'Escape') { e.preventDefault(); if (p.open === undefined) os[1](false); }
    }
    var desc = p.error || p.hint !== false ? id + '-d' : undefined;
    return h('div', { className: cx('zr-field', 'zr-mention', p.error && 'is-error', p.className) },
      p.label ? h('label', { htmlFor: id, className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-mention-anchor' },
      h('div', { className: 'zr-mention-box' },
        values.map(function (v) {
          return h('span', { key: v.id, className: 'zr-mention-chip' }, h(Avatar, { name: v.name, size: 'sm' }), h('span', { className: 'zr-mention-chip-name' }, v.name),
            h('button', { type: 'button', className: 'zr-mention-x', 'aria-label': L.remove + ' ' + v.name, onClick: function () { remove(v); } }, h(Icon, { name: 'close', size: 14 })));
        }),
        h('input', { id: id, type: 'text', value: text, placeholder: values.length ? '' : (p.placeholder || '@nome'), autoComplete: 'off', role: 'combobox',
          'aria-expanded': showList, 'aria-controls': id + '-l', 'aria-autocomplete': 'list', 'aria-describedby': desc, 'aria-invalid': !!p.error || undefined,
          'aria-activedescendant': showList && count ? id + '-o' + active : undefined,
          onChange: function (e) { setText(e.target.value); }, onKeyDown: onKey,
          onBlur: function () { if (p.open === undefined) setTimeout(function () { os[1](false); }, 120); } })),
      showList ? h('ul', { id: id + '-l', role: 'listbox', className: 'zr-mention-list', 'aria-label': L.results },
        list.map(function (s, i) {
          return h('li', { key: s.id, id: id + '-o' + i, role: 'option', 'aria-selected': i === active, className: cx('zr-mention-opt', i === active && 'is-active'),
            onMouseDown: function (e) { e.preventDefault(); pick(s); }, onMouseEnter: function () { as[1](i); } },
            h(Avatar, { name: s.name, size: 'md' }),
            h('span', { className: 'zr-mention-opt-text' }, h('strong', null, s.name), h('span', null, [s.email, s.sub].filter(Boolean).join(' · '))),
            s.tag ? h(Label, { tone: s.tagTone || 'neutral' }, s.tag) : null);
        }),
        canCreate ? h('li', { id: id + '-o' + list.length, role: 'option', 'aria-selected': active === list.length, className: cx('zr-mention-opt', 'is-create', active === list.length && 'is-active'),
          onMouseDown: function (e) { e.preventDefault(); create(); } },
          h('span', { className: 'zr-mention-plus', 'aria-hidden': true }, h(Icon, { name: 'plus', size: 16 })),
          h('span', { className: 'zr-mention-opt-text' }, h('strong', null, (p.createLabel || L.create).replace('{q}', text.slice(at + 1).trim())))) : null,
        !count ? h('li', { className: 'zr-mention-empty', role: 'option', 'aria-disabled': true }, L.empty) : null) : null),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint !== false ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint || L.hint) : null);
  }

  function Checkbox(p) {
    var id = useId('chk');
    var rest = omit(p, ['label', 'className', 'indeterminate', 'hint', 'error']);
    var ref = useRef(null);
    useEffect(function () { if (ref.current) ref.current.indeterminate = !!p.indeterminate; });
    var desc = p.error || p.hint ? id + '-d' : undefined; /* aiuto ed errore sotto, come Field (richiesta 144) */
    var wrap = 'hint' in p || 'error' in p; /* dalle props passate, non dal valore: l'errore che sparisce non rimonta la casella */
    var box = h('label', { className: cx('zr-check', p.error && 'is-error', !wrap && p.className) },
      h('input', Object.assign({ type: 'checkbox', ref: ref, 'aria-describedby': desc, 'aria-invalid': p.error ? true : undefined }, rest)),
      h('span', { className: 'zr-check-box', 'aria-hidden': true }, h(Icon, { name: p.indeterminate ? 'close' : 'check', size: 14 })),
      p.label ? h('span', null, p.label) : null);
    if (!wrap) return box;
    return h('div', { className: cx('zr-check-field', p.className) }, box,
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

  function Switch(p) {
    var ctrl = p.checked !== undefined;
    var st = useState(!!p.defaultChecked), on = ctrl ? p.checked : st[0];
    var off = p['aria-disabled'] === true || p['aria-disabled'] === 'true'; /* spento ma raggiungibile: tiene il fuoco */
    return h('button', { type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': p['aria-label'] || p.label, disabled: p.disabled, 'aria-disabled': off ? 'true' : undefined, 'aria-describedby': p['aria-describedby'], 'aria-invalid': p['aria-invalid'], className: cx('zr-switch', on && 'is-on', p.className),
      onClick: function () { if (off) return; if (!ctrl) st[1](!on); if (p.onChange) p.onChange(!on); } },
      h('span', { className: 'zr-switch-track', 'aria-hidden': true }, h('span', { className: 'zr-switch-thumb' })),
      p.label ? h('span', { className: 'zr-switch-label' }, p.label) : null);
  }

  function Tabs(p) {
    var items = p.items || [];
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue || (items[0] && (items[0].value || items[0]))), val = ctrl ? p.value : st[0];
    var vals = items.map(function (it) { return typeof it === 'string' ? it : it.value; });
    var stop = vals.indexOf(val) >= 0 ? val : vals[0]; /* una fermata sola del Tab: la linguetta scelta (richieste 151 e 69) */
    function pick(v) { if (!ctrl) st[1](v); if (p.onChange) p.onChange(v); }
    var ref = useRef(null);
    useEffect(function () { /* la riga che scorre di lato (underline sotto i 720 px) porta in vista la linguetta scelta, senza muovere la pagina (richiesta 204) */
      var l = ref.current, b = l && l.querySelector('.is-active'); if (!b || l.scrollWidth <= l.clientWidth) return;
      var r = b.getBoundingClientRect(), lr = l.getBoundingClientRect();
      if (r.left < lr.left) l.scrollLeft -= lr.left - r.left + 16; else if (r.right > lr.right) l.scrollLeft += r.right - lr.right + 16;
    }, [val]);
    function keys(e) {
      var i = vals.indexOf(e.target.getAttribute('data-value')); if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return; /* Alt+← resta «indietro» del browser */
      var n = e.key === 'ArrowRight' ? (i + 1) % vals.length : e.key === 'ArrowLeft' ? (i + vals.length - 1) % vals.length : e.key === 'Home' ? 0 : e.key === 'End' ? vals.length - 1 : -1;
      if (n < 0) return;
      e.preventDefault(); if (vals[n] !== val) pick(vals[n]);
      var b = e.currentTarget.querySelectorAll('[role="tab"]')[n]; if (b) b.focus();
    }
    return h('div', { className: cx('zr-seg', p.variant === 'underline' && 'is-underline', p.size === 'sm' && 'is-sm', p.className), ref: ref, role: 'tablist', 'aria-label': p['aria-label'], onKeyDown: keys },
      items.map(function (it) {
        var v = typeof it === 'string' ? it : it.value, l = typeof it === 'string' ? it : it.label;
        return h('button', { key: v, type: 'button', role: 'tab', 'data-value': v, 'aria-selected': v === val, 'aria-controls': it.panelId, id: it.panelId ? it.panelId + '-tab' : undefined, tabIndex: v === stop ? 0 : -1, className: cx('zr-seg-item', v === val && 'is-active'),
          onClick: function () { pick(v); } }, it.icon ? h(Icon, { name: it.icon, size: 16 }) : null, l, it.count != null ? countParts(it.count, 'zr-seg-count', it.countLabel) : null);
      }));
  }

  /* ---------- RadioGroup: una scelta fra poche, tutte in vista (richiesta 89) ---------- */
  function RadioGroup(p) {
    var id = useId('rad');
    var opts = p.options || [];
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : null), val = ctrl ? p.value : st[0];
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var card = p.variant === 'card'; /* ogni scelta un riquadro col titolo e la descrizione, anche in griglia (richiesta 177) */
    return h('fieldset', { id: p.id, className: cx('zr-radio-group', p.orientation === 'horizontal' && !card && 'is-horizontal', card && 'is-card', card && p.layout === 'grid' && 'is-grid', p.error && 'is-error', p.className), disabled: p.disabled, 'aria-describedby': desc, 'aria-label': p.label ? undefined : p['aria-label'] },
      p.label ? h('legend', { className: 'zr-field-label' }, p.label, p.required ? h('span', { className: 'zr-req', 'aria-hidden': true }, ' *') : null) : null,
      h('div', { className: 'zr-radio-list' }, opts.map(function (o, i) {
        var obj = typeof o === 'string' ? { value: o, label: o } : o;
        var hid = obj.hint ? id + '-h' + i : undefined, lid = id + '-l' + i; /* il nome è solo l'etichetta: l'aiuto, che sta nella stessa label, è la descrizione */
        return h('label', { key: obj.value, className: cx(card ? 'zr-radio-card' : 'zr-radio', obj.disabled && 'is-disabled') },
          h('input', { type: 'radio', name: p.name || id, value: obj.value, checked: obj.value === val, disabled: obj.disabled, required: p.required, 'aria-invalid': p.error ? true : undefined, 'aria-labelledby': lid, 'aria-describedby': cx(hid, desc) || undefined,
            onChange: function () { if (!ctrl) st[1](obj.value); if (p.onChange) p.onChange(obj.value); } }),
          card ? null : h('span', { className: 'zr-radio-dot', 'aria-hidden': true }),
          card ? h('span', { id: lid, className: 'zr-radio-card-title' }, obj.label) : h('span', { className: 'zr-radio-text' }, h('span', { id: lid }, obj.label), obj.hint ? h('span', { id: hid, className: 'zr-radio-hint' }, obj.hint) : null),
          card && obj.hint ? h('span', { id: hid, className: 'zr-radio-hint' }, obj.hint) : null);
      })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

  /* ---------- ColorPicker: il colore di un'opzione o di un workspace, fra i toni (richiesta 104) ---------- */
  var COLOR_NAMES = { pine: 'Verde', citrus: 'Giallo', coral: 'Rosso', sky: 'Blu', plum: 'Viola', neutral: 'Grigio' };
  function ColorPicker(p) {
    var id = useId('clr');
    var tones = (p.tones || ['pine', 'citrus', 'coral', 'sky', 'plum']).filter(function (t) { return TONES.indexOf(t) >= 0; });
    var names = Object.assign({}, COLOR_NAMES, p.names);
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : null), val = ctrl ? p.value : st[0];
    var desc = p.error || p.hint ? id + '-d' : undefined;
    var opts = (p.none ? [null] : []).concat(tones); /* null = nessun colore */
    return h('fieldset', { id: p.id, className: cx('zr-color-picker', p.error && 'is-error', p.className), disabled: p.disabled, 'aria-describedby': desc, 'aria-label': p.label ? undefined : p['aria-label'] },
      p.label ? h('legend', { className: 'zr-field-label' }, p.label) : null,
      h('div', { className: 'zr-color-list' }, opts.map(function (t) {
        var name = t ? names[t] : p.none;
        return h('label', { key: t || 'none', className: 'zr-color', title: name },
          h('input', { type: 'radio', name: p.name || id, value: t || '', checked: t === val, 'aria-invalid': p.error ? true : undefined,
            onChange: function () { if (!ctrl) st[1](t); if (p.onChange) p.onChange(t); } }),
          h('span', { className: cx('zr-color-dot', t ? 'is-' + t : 'is-none'), 'aria-hidden': true }),
          h('span', { className: 'zr-visually-hidden' }, name));
      })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

  /* ---------- ToggleGroup: scelte a pulsanti con lo stato premuto, una o più (richiesta 141) ---------- */
  function ToggleGroup(p) {
    var id = useId('tgl');
    var opts = p.options || [];
    var multi = !!p.multiple;
    var ctrl = p.value !== undefined;
    var st = useState(p.defaultValue !== undefined ? p.defaultValue : (multi ? [] : null)), val = ctrl ? p.value : st[0];
    function isOn(v) { return multi ? (val || []).indexOf(v) >= 0 : val === v; }
    function pick(v) {
      var next;
      if (multi) { var cur = val || []; next = cur.indexOf(v) >= 0 ? cur.filter(function (x) { return x !== v; }) : cur.concat([v]); }
      else if (val === v) { if (!p.allowEmpty) return; next = null; }
      else next = v;
      if (!ctrl) st[1](next);
      if (p.onChange) p.onChange(next);
    }
    var desc = p.error || p.hint ? id + '-d' : undefined;
    return h('div', { id: p.id, className: cx('zr-toggle-field', p.className) },
      p.label ? h('span', { id: id + '-l', className: 'zr-field-label' }, p.label) : null,
      h('div', { role: 'group', className: cx('zr-toggle-group', multi && 'is-multi', p.size === 'sm' && 'is-sm', p.layout === 'grid' && 'is-grid', p.error && 'is-error'),
        'aria-labelledby': p.label ? id + '-l' : undefined, 'aria-label': p.label ? undefined : p['aria-label'], 'aria-describedby': desc },
        opts.map(function (o) {
          var obj = typeof o === 'string' ? { value: o, label: o } : o;
          var on = isOn(obj.value);
          return h('button', { key: obj.value, type: 'button', className: cx('zr-toggle', on && 'is-on'), 'aria-pressed': on, disabled: p.disabled || obj.disabled, 'aria-label': obj['aria-label'], 'aria-describedby': desc, onClick: function () { pick(obj.value); } },
            multi && on && !obj.icon ? h(Icon, { name: 'check', size: 16 }) : obj.icon ? h(Icon, { name: obj.icon, size: 16 }) : null,
            h('span', null, obj.label),
            obj.count != null ? countParts(obj.count, 'zr-toggle-count', obj.countLabel) : null);
        })),
      p.error ? h('p', { id: desc, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : p.hint ? h('p', { id: desc, className: 'zr-field-msg' }, p.hint) : null);
  }

  /* ---------- InlineEdit: un valore che si modifica dove sta — clic, campo, «Salvato» o l'errore (richiesta 142) ---------- */
  var INLINE_EDIT_LABELS = { edit: 'Modifica', empty: 'Aggiungi', saving: 'Salvataggio…', saved: 'Salvato', error: 'Non salvato. Riprova.', required: 'Il campo non può restare vuoto', keys: 'Invio salva, Esc annulla', keysMultiline: 'Ctrl+Invio salva, Esc annulla', invalid: 'Il valore non è valido' };
  var INLINE_EDIT_TEXTS = { it: INLINE_EDIT_LABELS, /* nella lingua dell'app, da LabelsProvider o dalla pagina (richiesta 205) */
    en: { edit: 'Edit', empty: 'Add', saving: 'Saving…', saved: 'Saved', error: 'Not saved. Try again.', required: 'This field can\'t be empty', keys: 'Enter saves, Esc cancels', keysMultiline: 'Ctrl+Enter saves, Esc cancels', invalid: 'The value isn\'t valid' },
    es: { edit: 'Editar', empty: 'Añadir', saving: 'Guardando…', saved: 'Guardado', error: 'No guardado. Inténtalo de nuevo.', required: 'El campo no puede quedar vacío', keys: 'Intro guarda, Esc cancela', keysMultiline: 'Ctrl+Intro guarda, Esc cancela', invalid: 'El valor no es válido' } };
  function InlineEdit(p) {
    var id = useId('ied');
    var L = useCompLabels(INLINE_EDIT_TEXTS, p.labels);
    var value = p.value == null ? '' : String(p.value);
    /* as="select": una scelta fra opzioni, che salva appena scelta; in vista il nome dell'opzione. format: come si vede un valore (una data) (richiesta 184) */
    var sel = p.as === 'select', opts = (p.options || []).map(function (o) { return typeof o === 'string' ? { value: o, label: o } : o; });
    function shown(v) { if (sel) { for (var i = 0; i < opts.length; i++) if (opts[i].value === v) return opts[i].label; } return v && p.format ? p.format(v) : v; }
    var ctrl = p.editing !== undefined; /* editing controllato da chi usa il componente («Rinomina» in un menu), con onEditingChange */
    var es = useState(ctrl ? !!p.editing : !!p.defaultEditing), editing = ctrl ? !!p.editing : es[0];
    var ds = useState(value), draft = ds[0];
    var ss = useState('idle'), stato = ss[0]; /* idle · saving · saved · error */
    var ms = useState(''), msg = ms[0];
    var mode = useRef(editing ? 'edit' : 'view'), mounted = useRef(false), viewRef = useRef(null), fieldRef = useRef(null), timer = useRef(null), alive = useRef(true), back = useRef(false), ptr = useRef(false);
    useEffect(function () { alive.current = true; return function () { alive.current = false; clearTimeout(timer.current); }; }, []);
    /* saveOnUnmount: smontato col campo aperto, la bozza cambiata si salva una volta, se è valida e non è appena stata rifiutata (richiesta 193); nel cleanup del layout il campo c'è ancora */
    var last = useRef(null); last.current = { p: p, draft: draft, value: value, stato: stato };
    React.useLayoutEffect(function () { return function () {
      var l = last.current, q = l.p, f = fieldRef.current, vd = f && f.validity;
      if (!q.saveOnUnmount || !q.onSave || mode.current !== 'edit' || l.stato === 'error' || (vd && (vd.badInput || vd.typeMismatch))) return;
      var next = q.trim === false || q.as === 'select' ? l.draft : l.draft.trim();
      if (next === l.value || !next.trim() && (q.cancelOnEmpty || q.required) || (q.validate && q.validate(next))) return;
      try { var r = q.onSave(next); if (r && typeof r.then === 'function') r.then(null, function () {}); } catch (e) {} /* l'errore non ha più dove mostrarsi: lo gestisce chi usa il componente */
    }; }, []);
    /* aperto o chiuso da fuori: si riparte dal valore, e chiuso da fuori non salva */
    var pe = useState(editing);
    if (pe[0] !== editing) {
      pe[1](editing);
      if (editing && mode.current === 'view') { mode.current = 'edit'; ds[1](value); ss[1]('idle'); ms[1](''); }
      else if (!editing && mode.current === 'edit') { mode.current = 'view'; ss[1]('idle'); ms[1](''); }
    }
    useEffect(function () {
      var first = !mounted.current; mounted.current = true;
      if (editing && fieldRef.current && (!first || p.autoFocus)) { fieldRef.current.focus(); if (typeof fieldRef.current.select === 'function') fieldRef.current.select(); }
      if (!editing && back.current) { back.current = false; if (viewRef.current) viewRef.current.focus(); }
    }, [editing]);
    function setEditing(v) { if (!ctrl) es[1](v); if (p.onEditingChange) p.onEditingChange(v); }
    function close(focusBack) { mode.current = 'view'; back.current = focusBack; setEditing(false); }
    function start() { if (p.disabled) return; clearTimeout(timer.current); mode.current = 'edit'; ds[1](value); ss[1]('idle'); ms[1](''); setEditing(true); }
    function fail(m) { mode.current = 'edit'; ss[1]('error'); ms[1](m || L.error); }
    function save(focusBack, v) {
      if (mode.current !== 'edit') return;
      var src = v != null ? v : draft, next = p.trim === false || sel ? src : src.trim();
      var vd = fieldRef.current && fieldRef.current.validity; /* un numero, una data o un'email che il browser non accetta: il campo vale "" o il testo com'è, e non si salva; un valore arrivato così e non toccato si lascia */
      if (vd && (vd.badInput || (vd.typeMismatch && next !== value))) { fail(L.invalid); return; }
      if (next === value || (p.cancelOnEmpty && !next.trim())) { ss[1]('idle'); close(focusBack); return; } /* cancelOnEmpty: il vuoto annulla e torna il valore di prima */
      if (p.required && !next) { fail(L.required); return; }
      var bad = p.validate ? p.validate(next) : null;
      if (bad) { fail(bad); return; }
      mode.current = 'saving'; ss[1]('saving'); ms[1]('');
      Promise.resolve().then(function () { return p.onSave ? p.onSave(next) : undefined; }).then(function () {
        if (!alive.current) return;
        close(focusBack && document.activeElement === fieldRef.current); ss[1]('saved'); /* il fuoco torna solo se è ancora nel campo */
        timer.current = setTimeout(function () { if (alive.current) ss[1](function (s) { return s === 'saved' ? 'idle' : s; }); }, 2500);
      }, function (e) { if (alive.current) fail(e && e.message); });
    }
    /* il tetto in caratteri, non in unità UTF-16 (richiesta 182), come maxlength: dell'inserimento entra ciò che ci sta, il resto del testo non si tocca, e un valore già oltre il tetto si può accorciare */
    function cap(v, prev, el) {
      var a = Array.from(v), b = Array.from(prev);
      if (!p.maxLength || a.length <= p.maxLength || a.length <= b.length) return v;
      var i = 0, j = 0, end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : -1;
      if (end >= 0) j = Math.min(b.length, Array.from(v.slice(end)).length); /* dopo il cursore c'è ciò che c'era dopo l'inserimento */
      else while (j < b.length && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
      while (i < b.length - j && a[i] === b[i]) i++;
      var put = a.slice(i, a.length - j).slice(0, Math.max(0, p.maxLength - i - j)), head = a.slice(0, i).concat(put).join('');
      var out = head + a.slice(a.length - j).join('');
      if (el) { el.value = out; try { el.setSelectionRange(head.length, head.length); } catch (e) {} } /* il cursore resta dopo ciò che è entrato */
      return out;
    }
    var pre = useRef('');
    function onKey(e) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return; /* Invio ed Esc dell'IME confermano o annullano la composizione (richiesta 181) */
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (mode.current !== 'saving') { ss[1]('idle'); close(true); } }
      else if (e.key === 'Enter' && (!p.multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); save(true); }
    }
    var size = p.size === 'title' ? 'title' : 'body';
    var errId = id + '-e', keysId = id + '-k';
    var body;
    if (editing) {
      var attrs = { ref: fieldRef, id: id, value: draft, className: 'zr-inline-edit-field', 'aria-label': p.label, 'aria-invalid': stato === 'error' || undefined, 'aria-busy': stato === 'saving' || undefined,
        'aria-describedby': cx(stato === 'error' && errId, keysId), readOnly: stato === 'saving', placeholder: p.placeholder,
        onChange: function (e) { ds[1](e.nativeEvent.isComposing ? e.target.value : cap(e.target.value, draft, e.target)); if (stato === 'error') { ss[1]('idle'); ms[1](''); } },
        onCompositionStart: function () { pre.current = draft; }, onCompositionEnd: function (e) { ds[1](cap(e.target.value, pre.current, e.target)); }, onKeyDown: onKey, onBlur: function () { save(false); } };
      /* la scelta col puntatore salva subito; con la tastiera le frecce la spostano (su Windows e Linux cambiano la select chiusa) e Invio o l'uscita salvano; mentre salva è ferma */
      var busy = stato === 'saving', known = opts.some(function (o) { return o.value === draft; });
      body = sel ? h('span', { className: 'zr-inline-edit-select' }, h('select', Object.assign({}, attrs, { readOnly: undefined, placeholder: undefined, onCompositionStart: undefined, onCompositionEnd: undefined, 'aria-disabled': busy || undefined,
          onPointerDown: function () { ptr.current = true; }, onMouseDown: function (e) { if (busy) e.preventDefault(); },
          onKeyDown: function (e) { ptr.current = false; if (busy && e.key !== 'Tab') { e.preventDefault(); return; } onKey(e); },
          onChange: function (e) { if (mode.current !== 'edit') return; ds[1](e.target.value); if (ptr.current) save(true, e.target.value); } }),
          known ? null : h('option', { value: draft, disabled: true }, draft || p.placeholder || L.empty), /* senza valore, o con uno che non è fra le opzioni, nessuna opzione vera è già scelta */
          opts.map(function (o) { return h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label); })), h(Icon, { name: 'chevronDown', size: 16 }))
        : p.multiline ? h('textarea', Object.assign({ rows: p.rows || 3 }, attrs)) : h('input', Object.assign({ type: p.type || 'text' }, attrs));
    } else {
      body = h('button', { ref: viewRef, type: 'button', className: cx('zr-inline-edit-view', !value && 'is-empty'), disabled: p.disabled, onClick: start,
        'aria-label': L.edit + ': ' + p.label + (value ? ', ' + shown(value) : '') },
        h('span', { className: 'zr-inline-edit-text' }, value && p.view ? p.view(value) : shown(value) || p.placeholder || L.empty), p.disabled ? null : h(Icon, { name: 'edit', size: 14 }));
      /* view: come si vede il valore dentro il pulsante; actions: accanto, fuori dal clic che apre il campo (un link, «Chiama») (richiesta 192) */
      if (p.actions) body = h('div', { className: 'zr-inline-edit-row' }, body, h('span', { className: 'zr-inline-edit-actions' }, p.actions));
    }
    return h('div', { className: cx('zr-inline-edit', 'is-' + size, editing && 'is-editing', stato === 'error' && 'is-error', p.multiline && 'is-multiline', p.className) },
      body,
      editing && stato === 'error' ? h('p', { id: errId, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), msg) : null,
      editing ? h('p', { id: keysId, className: 'zr-inline-edit-keys' }, p.multiline ? L.keysMultiline : L.keys) : null,
      h('p', { className: cx('zr-inline-edit-status', stato === 'saved' && 'is-saved'), role: 'status' },
        stato === 'saving' ? L.saving : stato === 'saved' ? [h(Icon, { key: 'i', name: 'check', size: 14 }), h('span', { key: 't' }, L.saved)] : null));
  }

  /* ---------- Calendar: scegliere un giorno, il mese con gli eventi, la settimana al telefono (richiesta 140) ---------- */
  var CALENDAR_LABELS = { prevMonth: 'Mese precedente', nextMonth: 'Mese successivo', prevWeek: 'Settimana precedente', nextWeek: 'Settimana successiva', marked: 'disponibile',
    events: function (n) { return n === 1 ? '1 evento' : n + ' eventi'; }, more: function (n) { return '+' + n + ' altri'; } };
  var DAY_MS = 86400000;
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoOfT(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function tOfIso(iso) { var a = String(iso).split('-'); return Date.UTC(+a[0], +a[1] - 1, +(a[2] || 1)); }
  function addMonths(iso, n) {
    var a = iso.split('-'), y = +a[0], m = +a[1] - 1 + n, d = +a[2];
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return isoOfT(Date.UTC(y, m, Math.min(d, last)));
  }
  function localTodayIso() { var n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate()); }
  function Calendar(p) {
    var id = useId('cal');
    var loc = p.locale || 'it-IT';
    var L = Object.assign({}, CALENDAR_LABELS, p.labels || {});
    var variant = p.variant === 'month' || p.variant === 'week' ? p.variant : 'picker';
    var today = p.today || localTodayIso();
    var ctrl = p.value !== undefined;
    var vs = useState(p.defaultValue || null), sel = ctrl ? p.value : vs[0];
    var cs = useState(sel || (p.defaultMonth ? p.defaultMonth + '-01' : today)), cursor = cs[0];
    var moveFocus = useRef(false), rootRef = useRef(null);
    useEffect(function () { if (ctrl && p.value) cs[1](p.value); }, [p.value]);
    var wk = p.weekStartsOn != null ? p.weekStartsOn : 1;
    var dow = function (t) { return (new Date(t).getUTCDay() - wk + 7) % 7; };
    var ct = tOfIso(cursor);
    var from, n;
    if (variant === 'week') { from = ct - dow(ct) * DAY_MS; n = 7; }
    else {
      var first = tOfIso(cursor.slice(0, 7) + '-01');
      var days = new Date(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth() + 1, 0)).getUTCDate();
      from = first - dow(first) * DAY_MS;
      n = variant === 'picker' ? 42 : Math.ceil((dow(first) + days) / 7) * 7;
    }
    var fromIso = isoOfT(from), toIso = isoOfT(from + (n - 1) * DAY_MS);
    var month = cursor.slice(0, 7);
    useEffect(function () { if (p.onRangeChange) p.onRangeChange({ from: fromIso, to: toIso }); }, [fromIso, toIso]);
    useEffect(function () {
      if (!moveFocus.current || !rootRef.current) return;
      moveFocus.current = false;
      var b = rootRef.current.querySelector('[data-iso="' + cursor + '"]'); if (b) b.focus();
    }, [cursor]);
    var fmt = function (o) { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: 'UTC' }, o)); };
    var fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), fWdS = fmt({ weekday: 'short' }), fWdL = fmt({ weekday: 'long' });
    var titleText = fmt({ month: 'long', year: 'numeric' }).format(ct);
    titleText = titleText.charAt(0).toLocaleUpperCase(loc) + titleText.slice(1);
    var marked = p.marked || [];
    var evs = {}; (p.events || []).forEach(function (e) { (evs[e.date] = evs[e.date] || []).push(e); });
    function off(iso) { return (p.min && iso < p.min) || (p.max && iso > p.max) || (p.isDisabled ? !!p.isDisabled(iso) : false); }
    function choose(iso) { if (off(iso)) return; moveFocus.current = iso !== cursor; cs[1](iso); if (!ctrl) vs[1](iso); if (p.onChange) p.onChange(iso); }
    function go(iso, focus) { if (iso === cursor) return; moveFocus.current = !!focus; cs[1](iso); }
    function shift(k) { go(variant === 'week' ? isoOfT(ct + k * 7 * DAY_MS) : addMonths(cursor, k), false); }
    function onKey(e) {
      var k = e.key, t = null;
      if (k === 'ArrowLeft') t = isoOfT(ct - DAY_MS);
      else if (k === 'ArrowRight') t = isoOfT(ct + DAY_MS);
      else if (k === 'ArrowUp' && variant !== 'week') t = isoOfT(ct - 7 * DAY_MS);
      else if (k === 'ArrowDown' && variant !== 'week') t = isoOfT(ct + 7 * DAY_MS);
      else if (k === 'Home') t = isoOfT(ct - dow(ct) * DAY_MS);
      else if (k === 'End') t = isoOfT(ct + (6 - dow(ct)) * DAY_MS);
      else if (k === 'PageUp') t = variant === 'week' ? isoOfT(ct - 7 * DAY_MS) : addMonths(cursor, e.shiftKey ? -12 : -1);
      else if (k === 'PageDown') t = variant === 'week' ? isoOfT(ct + 7 * DAY_MS) : addMonths(cursor, e.shiftKey ? 12 : 1);
      if (t) { e.preventDefault(); go(t, true); }
    }
    function dayButton(iso, t, extra) {
      var dis = off(iso), list = evs[iso] || [], isMarked = marked.indexOf(iso) >= 0;
      var name = fLong.format(t) + (isMarked ? ', ' + L.marked : '') + (list.length ? ', ' + L.events(list.length) : '');
      return h('button', { type: 'button', 'data-iso': iso, tabIndex: iso === cursor ? 0 : -1, className: cx('zr-cal-day', iso === sel && 'is-selected', iso === today && 'is-today', dis && 'is-disabled', isMarked && 'is-marked'),
        'aria-label': name, 'aria-current': iso === today ? 'date' : undefined, 'aria-disabled': dis ? 'true' : undefined, 'aria-pressed': variant === 'week' ? iso === sel : undefined,
        onFocus: function () { if (iso !== cursor && (variant === 'week' || iso.slice(0, 7) === month)) cs[1](iso); }, /* le frecce ripartono dal giorno col fuoco; un giorno di un altro mese cambia mese solo al clic */ onClick: function () { choose(iso); } }, extra, h('span', { className: 'zr-cal-num' }, new Date(t).getUTCDate()), isMarked ? h('span', { className: 'zr-cal-dot', 'aria-hidden': true }) : null);
    }
    var titleId = id + '-t';
    var head = h('div', { className: 'zr-cal-head' },
      h('div', { id: titleId, className: 'zr-cal-title', 'aria-live': 'polite' }, titleText),
      h('div', { className: 'zr-cal-nav' },
        h(Button, { variant: 'ghost', size: 'sm', icon: 'chevronLeft', 'aria-label': variant === 'week' ? L.prevWeek : L.prevMonth, onClick: function () { shift(-1); } }),
        h(Button, { variant: 'ghost', size: 'sm', icon: 'chevron', 'aria-label': variant === 'week' ? L.nextWeek : L.nextMonth, onClick: function () { shift(1); } })));
    var body;
    if (variant === 'week') {
      body = h('div', { role: 'group', 'aria-labelledby': titleId, className: 'zr-cal-week', onKeyDown: onKey },
        Array.from({ length: 7 }, function (_, i) {
          var t = from + i * DAY_MS, iso = isoOfT(t);
          return h('div', { key: iso, className: 'zr-cal-week-cell' }, dayButton(iso, t, h('span', { className: 'zr-cal-wd', 'aria-hidden': true }, fWdS.format(t))));
        }));
    } else {
      var rows = [];
      for (var r = 0; r < n / 7; r++) {
        rows.push(h('tr', { key: r }, Array.from({ length: 7 }, function (_, i) {
          var t = from + (r * 7 + i) * DAY_MS, iso = isoOfT(t), out = iso.slice(0, 7) !== month, list = evs[iso] || [];
          var max = p.maxEvents || 3, shown = list.length > max ? list.slice(0, max - 1) : list;
          return h('td', { key: iso, role: 'gridcell', 'aria-selected': iso === sel, className: cx('zr-cal-cell', out && 'is-outside') },
            dayButton(iso, t),
            variant === 'month' && list.length ? h('ul', { className: 'zr-cal-evs' },
              shown.map(function (e, k) {
                var tone = TONES.indexOf(e.tone) >= 0 ? e.tone : 'pine';
                return h('li', { key: e.id || k }, p.onEventClick
                  ? h('button', { type: 'button', tabIndex: iso === cursor ? 0 : -1, className: cx('zr-cal-ev', 'zr-cal-ev-' + tone), onClick: function () { p.onEventClick(e); } }, e.label)
                  : h('span', { className: cx('zr-cal-ev', 'zr-cal-ev-' + tone) }, e.label));
              }),
              list.length > shown.length ? h('li', { key: 'more' }, h('button', { type: 'button', tabIndex: iso === cursor ? 0 : -1, className: 'zr-cal-more', onClick: function () { if (p.onMore) p.onMore(iso); else choose(iso); } }, L.more(list.length - shown.length))) : null) : null);
        })));
      }
      body = h('table', { role: 'grid', 'aria-labelledby': titleId, className: 'zr-cal-grid', onKeyDown: onKey },
        h('thead', null, h('tr', null, Array.from({ length: 7 }, function (_, i) { var t = from + i * DAY_MS; return h('th', { key: i, scope: 'col', abbr: fWdL.format(t) }, fWdS.format(t)); }))),
        h('tbody', null, rows));
    }
    return h('div', { ref: rootRef, className: cx('zr-cal', 'is-' + variant, p.className) }, head, body);
  }

  /* ---------- AgendaGrid: la griglia di un'agenda con le ore (richiesta 202) ---------- */
  var AGENDA_LABELS = { instructions: 'Frecce su e giù per l\'ora, a sinistra e a destra per il giorno; Invio sceglie un\'ora da lì, Esc toglie il segno.', allDay: 'Tutto il giorno', marker: '{day}, {time}' };
  var AGENDA_TEXTS = { it: AGENDA_LABELS,
    en: { instructions: 'Up and down arrows for the time, left and right for the day; Enter picks an hour from there, Esc clears the marker.', allDay: 'All day', marker: '{day}, {time}' },
    es: { instructions: 'Flechas arriba y abajo para la hora, izquierda y derecha para el día; Intro elige una hora desde ahí, Esc quita la marca.', allDay: 'Todo el día', marker: '{day}, {time}' } };
  var ON_TONE = ['pine', 'citrus', 'coral']; /* i toni che hanno il testo sopra il colore pieno (on-*) */
  function minOf(t) { var a = String(t || '0:0').split(':'); return (+a[0] || 0) * 60 + (+a[1] || 0); }
  function hhmm(m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
  function agendaLanes(list) { /* gli eventi che si sovrappongono si dividono la colonna; quelli passivi stanno sotto, a tutta larghezza */
    var out = [], group = [], end = -1;
    function close() { var n = 0; group.forEach(function (g) { n = Math.max(n, g.lane + 1); }); group.forEach(function (g) { g.of = n; }); group = []; }
    list.slice().sort(function (x, y) { return x.a - y.a || y.b - x.b; }).forEach(function (it) {
      if (it.a >= end) { close(); end = -1; }
      var used = group.filter(function (g) { return g.b > it.a; }).map(function (g) { return g.lane; }), lane = 0;
      while (used.indexOf(lane) >= 0) lane++;
      it.lane = lane; group.push(it); out.push(it); end = Math.max(end, it.b);
    });
    close();
    return out;
  }
  function AgendaGrid(p) {
    var id = useId('agd'), L = useCompLabels(AGENDA_TEXTS, p.labels);
    var loc = p.locale || 'it-IT', days = p.days || [], step = p.step || 15, H = p.hourHeight || 48;
    var today = p.today || localTodayIso(), selectable = !!p.onSelect;
    var dr = useState(null), drag = dr[0], setDrag = dr[1];
    var mk = useState(null), mark = mk[0], setMark = mk[1];
    var colsRef = useRef(null);
    var starts = [p.startHour != null ? p.startHour : 8], ends = [p.endHour != null ? p.endHour : 19];
    days.forEach(function (d) { (d.events || []).forEach(function (e) { if (!e.passive) { starts.push(Math.floor(minOf(e.start) / 60)); ends.push(Math.ceil(minOf(e.end) / 60)); } }); }); /* un evento fuori dalle ore le allarga; uno passivo no, si ritaglia */
    var first = Math.max(0, Math.min.apply(null, starts)), last = Math.min(24, Math.max.apply(null, ends)), lo = first * 60, hi = last * 60;
    var hours = []; for (var x = first; x < last; x++) hours.push(x);
    var fmt = function (o) { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: 'UTC' }, o)); };
    var fWd = fmt({ weekday: 'short' }), fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' }), fHour = fmt({ hour: 'numeric', minute: '2-digit' });
    function tOf(iso) { return tOfIso(iso) + 12 * 3600000; }
    function fill(t, k, v) { return t.replace(k, function () { return v; }); }
    function y(m) { return (m - lo) * H / 60; }
    function minuteAt(e, down) { var r = e.currentTarget.getBoundingClientRect(), q = (e.clientY - r.top) / H * 60 / step; return Math.min(hi, Math.max(lo, lo + (down ? Math.floor(q) : Math.round(q)) * step)); } /* si parte dal quarto d'ora toccato, si arriva al più vicino */
    function pick(date, a, b) { setMark(null); p.onSelect({ date: date, start: hhmm(a), end: hhmm(b) }); }
    function nearEvent(e) { /* al tocco un evento cliccabile si prende su 44 px: il più vicino entro (44 − altezza) / 2 sopra o sotto, solo nello spazio libero (il riquadro di un evento è suo) */
      var best = null, dist = Infinity;
      [].forEach.call(e.currentTarget.querySelectorAll('button.zr-agenda-ev'), function (b) {
        var r = b.getBoundingClientRect(), dy = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
        if (e.clientX >= r.left && e.clientX <= r.right && dy <= Math.max(0, (44 - r.height) / 2) && dy < dist) { best = b; dist = dy; }
      });
      if (best) best.click(); return !!best;
    }
    function hourFrom(a) { return Math.min(a + 60, hi); } /* «un'ora da lì», fino alla fine della griglia (revisione 1, R4) */
    function tone(e) { return TONES.indexOf(e.tone) >= 0 ? e.tone : 'pine'; }
    function look(e) { var t = tone(e), v = e.variant === 'solid' && ON_TONE.indexOf(t) >= 0 ? 'solid' : e.variant === 'outline' ? 'outline' : 'soft'; return cx('zr-agenda-ev', 'zr-agenda-' + v, 'zr-agenda-tone-' + t); }
    function item(e, date, cls, style, body, name, key) {
      var click = p.onEventClick && !e.passive && e.clickable !== false;
      return click
        ? h('button', { key: e.id != null ? e.id : key, type: 'button', className: cls, style: style, 'aria-label': e.label || name,
            onPointerDown: function (ev) { ev.stopPropagation(); }, onPointerUp: function (ev) { ev.stopPropagation(); }, onClick: function () { p.onEventClick(e, date); } }, body)
        : h('div', { key: e.id != null ? e.id : key, className: cx(cls, 'is-static'), style: style, 'aria-label': e.label || undefined, role: e.label ? 'img' : undefined }, body); /* senza clic non ferma la scelta: il trascinamento ci passa sotto */
    }
    function keys(e, date, i) {
      if (e.target !== e.currentTarget) return; /* i tasti di un evento dentro la colonna sono suoi */
      var k = e.key, at = mark && mark.date === date ? mark.at : null;
      if (k === 'Enter' || k === ' ') { e.preventDefault(); var a = at != null ? at : lo; pick(date, a, hourFrom(a)); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        var cols = colsRef.current ? colsRef.current.querySelectorAll('.zr-agenda-col') : [], j = i + (k === 'ArrowLeft' ? -1 : 1);
        if (j < 0 || j >= cols.length) return;
        e.preventDefault(); cols[j].focus(); if (at != null) setMark({ date: days[j].date, at: at }); return;
      }
      var n = k === 'Escape' ? null : k === 'Home' ? lo : k === 'End' ? hi - step : k === 'ArrowDown' ? (at == null ? lo : Math.min(hi - step, at + step)) : k === 'ArrowUp' ? (at == null ? lo : Math.max(lo, at - step)) : undefined;
      if (n === undefined || (k === 'Escape' && at == null)) return; /* Esc senza segno resta della pagina (un dialogo, un pannello) */
      e.preventDefault(); if (k === 'Escape') e.stopPropagation();
      setMark(n == null ? null : { date: date, at: n });
    }
    var grid = { gridTemplateColumns: 'var(--zr-agenda-hours) repeat(' + Math.max(1, days.length) + ', minmax(var(--zr-agenda-col-min), 1fr))' };
    var hasAllDay = days.some(function (d) { return (d.allDay || []).length; });
    var sel = p.selection;
    var markDay = mark && days.filter(function (d) { return d.date === mark.date; })[0];
    return h('div', { className: cx('zr-agenda', p.className), style: { '--zr-agenda-hour': H + 'px' }, role: 'group', 'aria-label': p['aria-label'] },
      selectable ? h('span', { id: id + '-i', className: 'zr-visually-hidden' }, L.instructions) : null,
      selectable ? h('span', { className: 'zr-visually-hidden', role: 'status', 'aria-live': 'polite' }, markDay ? fill(fill(L.marker, '{day}', fLong.format(tOf(markDay.date))), '{time}', hhmm(mark.at)) : '') : null,
      h('div', { className: 'zr-agenda-scroll' },
        h('div', { ref: colsRef, className: 'zr-agenda-grid', style: grid },
          h('div', { className: 'zr-agenda-corner' }),
          days.map(function (d) {
            var t = tOf(d.date), now = d.date === today;
            return h('div', { key: 'h' + d.date, className: cx('zr-agenda-head', now && 'is-today'), 'aria-current': now ? 'date' : undefined },
              h('span', { className: 'zr-agenda-dow' }, fWd.format(t)), h('strong', { className: 'zr-agenda-num' }, new Date(t).getUTCDate()));
          }),
          hasAllDay ? h('div', { className: 'zr-agenda-corner is-allday' }, h('span', { className: 'zr-visually-hidden' }, L.allDay)) : null,
          hasAllDay ? days.map(function (d) {
            return h('div', { key: 'a' + d.date, className: 'zr-agenda-allday' }, (d.allDay || []).map(function (e, k) {
              return item(e, d.date, look(e), undefined, h('span', { className: 'zr-agenda-ev-line' }, e.title), e.title, 'a' + k);
            }));
          }) : null,
          h('div', { className: 'zr-agenda-hours', style: { height: hours.length * H } }, hours.slice(1).map(function (hr, k) {
            return h('span', { key: hr, style: { top: (k + 1) * H } }, fHour.format(Date.UTC(2000, 0, 1, hr)));
          })),
          days.map(function (d, i) {
            var list = [];
            (d.events || []).forEach(function (e, k) {
              var a = minOf(e.start), b = minOf(e.end);
              if (e.passive) { a = Math.max(a, lo); b = Math.min(b, hi); }
              if (b > a) list.push({ e: e, a: a, b: b, k: k });
            });
            var back = list.filter(function (o) { return o.e.passive; }), front = agendaLanes(list.filter(function (o) { return !o.e.passive; }));
            var live = drag && drag.date === d.date ? drag : null, m = mark && mark.date === d.date ? mark : null, s = sel && sel.date === d.date ? sel : null;
            function box(o) {
              var e = o.e, top = y(o.a), ht = Math.max((o.b - o.a) * H / 60 - 2, 16), n = o.of || 1, ln = o.lane || 0;
              var style = { top: top, height: ht, left: 'calc(' + (ln * 100 / n) + '% + 3px)', width: 'calc(' + (100 / n) + '% - 6px)' };
              var time = e.start + '–' + e.end, name = [e.title, e.subtitle, time].filter(Boolean).join(', ');
              var body = ht < 36
                ? h('span', { className: 'zr-agenda-ev-line' }, h('span', { className: 'zr-agenda-ev-time' }, e.start), ' ', e.title) /* corto: una riga, l'ora davanti */
                : [h('strong', { key: 't' }, e.title), h('span', { key: 's' }, e.subtitle || time)];
              return item(e, d.date, cx(look(e), e.passive && 'is-passive'), style, body, name, 'e' + o.k);
            }
            function band(a, b, text) { a = Math.max(a, lo); b = Math.min(b, hi); if (b <= a) return null; /* una scelta fuori dalle ore mostrate si taglia sulla griglia */ return h('div', { className: 'zr-agenda-sel', 'aria-hidden': true, style: { top: y(a), height: Math.max((b - a) * H / 60, H / 4) } }, text); }
            return h('div', { key: 'c' + d.date, className: 'zr-agenda-col' + (d.date === today ? ' is-today' : ''), style: { height: hours.length * H },
                tabIndex: selectable ? 0 : undefined, role: selectable ? 'application' : 'group', 'aria-label': fLong.format(tOf(d.date)), /* application: NVDA e JAWS passano le frecce alla colonna (revisione 1, R2) */ 'aria-describedby': selectable ? id + '-i' : undefined,
                onPointerDown: selectable ? function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} var a = Math.min(minuteAt(e, true), hi - step); setDrag({ date: d.date, a: a, b: a, y0: e.clientY, moved: false }); } : undefined,
                onPointerMove: selectable ? function (e) { if (live && (live.moved || Math.abs(e.clientY - live.y0) >= 6)) setDrag(Object.assign({}, live, { b: minuteAt(e), moved: true })); } : undefined, /* sotto i 6 px è ancora un tocco (revisione 1, R1) */
                onPointerUp: selectable ? function (e) { if (!live) return; var a = Math.min(live.a, live.b), b = Math.max(live.a, live.b); setDrag(null);
                  if (!live.moved && e.pointerType === 'touch' && nearEvent(e)) return; /* un dito vicino a un evento breve lo apre (revisione 2, N1 e N2) */
                  pick(d.date, a, !live.moved ? hourFrom(a) : Math.max(b, a + step)); } : undefined, /* un tocco senza trascinare: un'ora */
                onPointerCancel: selectable ? function () { setDrag(null); } : undefined,
                onKeyDown: selectable ? function (e) { keys(e, d.date, i); } : undefined,
                onBlur: selectable ? function (e) { if (e.target === e.currentTarget) setMark(function (v) { return v && v.date === d.date ? null : v; }); } : undefined },
              back.map(box), s ? band(minOf(s.start), minOf(s.end), s.start + '–' + s.end) : null, front.map(box),
              live ? (function () { var a = Math.min(live.a, live.b), b = live.moved ? Math.max(live.a, live.b, a + step) : hourFrom(a); return band(a, b, hhmm(a) + '–' + hhmm(b)); })() : null, /* la fascia mostra ciò che il rilascio sceglierà: un'ora finché è un tocco (revisione 2, N3) */
              m ? band(m.at, hourFrom(m.at), null) : null);
          }))));
  }

  /* ---------- LabelsProvider ---------- */
  /* i testi comuni dei componenti (Chiudi, Annulla, Indietro, Aggiungi, Togli) nella lingua dell'app (richiesta 186): la lingua la dà
     LabelsProvider, altrimenti <html lang> (letto a ogni disegno); una lingua che non c'è prende quella di sopra, poi <html lang>, poi l'inglese (senza nessuna lingua, l'italiano). La prop del
     componente (closeLabel, backLabel, submitLabel…) vince sempre */
  var COMMON_LABELS = {
    it: { lang: 'it', close: 'Chiudi', cancel: 'Annulla', back: 'Indietro', add: 'Aggiungi', remove: 'Togli', unread: 'non letta' },
    en: { lang: 'en', close: 'Close', cancel: 'Cancel', back: 'Back', add: 'Add', remove: 'Remove', unread: 'unread' },
    es: { lang: 'es', close: 'Cerrar', cancel: 'Cancelar', back: 'Atrás', add: 'Añadir', remove: 'Quitar', unread: 'no leída' }
  };
  var labelsCtx = null; /* creato al primo uso: nessuna chiamata a React mentre il bundle si carica */
  function labelsContext() { return labelsCtx || (labelsCtx = React.createContext(null)); }
  function labelsLang(l) { var k = String(l || '').toLowerCase().split('-')[0]; return Object.prototype.hasOwnProperty.call(COMMON_LABELS, k) ? k : null; }
  function pageLabels(dichiarata) { var l = typeof document !== 'undefined' && document.documentElement.lang; return COMMON_LABELS[labelsLang(l)] || (l || dichiarata ? COMMON_LABELS.en : COMMON_LABELS.it); } /* una lingua dichiarata che non c'è cade sull'inglese, come la cornice; nessuna lingua: l'italiano di sempre */
  function useLabels() { return React.useContext(labelsContext()) || pageLabels(); }
  /* i testi propri di un componente (InlineEdit, DataTable, AgendaGrid) nella stessa lingua dei testi comuni; la prop labels vince sempre (richiesta 205) */
  function useCompLabels(texts, own) { var C = useLabels(); return Object.assign({}, texts[C.lang] || texts.it, own || {}); }
  function LabelsProvider(p) {
    var up = React.useContext(labelsContext()), l = p.labels || {};
    var base = p.lang ? COMMON_LABELS[labelsLang(p.lang)] || up || pageLabels(true) : up || (p.labels ? pageLabels() : null); /* solo testi: la lingua di <html lang>, riletta a ogni disegno */
    var value = React.useMemo(function () {
      if (!base) return null; /* niente lingua e niente testi: i componenti leggono <html lang> */
      var o = Object.assign({}, base);
      Object.keys(l).forEach(function (k) { if (l[k] != null) o[k] = l[k]; });
      return o;
    }, [base, l.close, l.cancel, l.back, l.add, l.remove, l.unread]);
    return h(labelsContext().Provider, { value: value }, p.children);
  }

  /* ---------- Feedback ---------- */
  var TONE_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'xCircle' };
  function Alert(p) {
    var tone = p.tone || 'info', C = useLabels();
    return h('div', { className: cx('zr-alert', 'zr-alert-' + tone, p.className), role: tone === 'danger' ? 'alert' : 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 20 }),
      h('div', { className: 'zr-alert-body' }, p.title ? h('strong', null, p.title) : null, p.children ? h('div', null, p.children) : null),
      p.action || null,
      p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }) : null);
  }

  function Toast(p) {
    var tone = p.tone || 'success', C = useLabels();
    return h('div', { className: cx('zr-toast', 'zr-toast-' + tone), role: 'status' },
      h(Icon, { name: TONE_ICON[tone], size: 18 }),
      h('span', { className: 'zr-toast-text' }, p.children),
      p.actionLabel ? h('button', { type: 'button', className: 'zr-toast-action', onClick: p.onAction }, p.actionLabel) : null,
      p.onClose ? h('button', { type: 'button', className: 'zr-toast-close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }, h(Icon, { name: 'close', size: 16 })) : null);
  }

  function Dialog(p) {
    var id = useId('dlg'), C = useLabels();
    useEffect(function () {
      if (!p.open) return;
      function k(e) { if (e.key === 'Escape' && p.onClose) p.onClose(); }
      document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); };
    }, [p.open]);
    if (!p.open) return null;
    /* size="sm": una domanda sì/no resta piccola e al centro anche al telefono (richiesta 53) */
    return h('div', { className: cx('zr-scrim', p.inline && 'is-inline', p.size === 'sm' && 'is-compact'), onMouseDown: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { className: cx('zr-dialog', p.size === 'lg' && 'is-lg', p.size === 'sm' && 'is-sm'), role: 'dialog', 'aria-modal': true, 'aria-labelledby': id },
        h('header', { className: 'zr-dialog-head' }, h('h2', { id: id }, p.title), p.onClose ? h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose }) : null),
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
        h('h1', null, p.title, p.count != null ? countParts(fmtNum(p.count), 'zr-count zr-page-count', p.countLabel) : null),
        p.subtitle ? h('p', null, p.subtitle) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

  /* ---------- Data ---------- */
  var DATATABLE_LABELS = { selected: '{n} selezionati', selectedOne: '{n} selezionato', deselect: 'Deseleziona', selectAll: 'Seleziona tutti', selectRow: 'Seleziona riga', selectRowName: 'Seleziona {name}', range: '{from}–{to} di {total}', prev: 'Pagina precedente', next: 'Pagina successiva', emptyTitle: 'Nessun risultato', emptyText: 'Prova a cambiare i filtri.', sortBy: 'Ordina per', sortNone: 'Ordine iniziale', ascending: '{col}, crescente', descending: '{col}, decrescente', more: 'Mostra altri' };
  var DATATABLE_TEXTS = { it: DATATABLE_LABELS, /* nella lingua dell'app, da LabelsProvider o dalla pagina (richiesta 205) */
    en: { selected: '{n} selected', selectedOne: '{n} selected', deselect: 'Deselect', selectAll: 'Select all', selectRow: 'Select row', selectRowName: 'Select {name}', range: '{from}–{to} of {total}', prev: 'Previous page', next: 'Next page', emptyTitle: 'No results', emptyText: 'Try changing the filters.', sortBy: 'Sort by', sortNone: 'Original order', ascending: '{col}, ascending', descending: '{col}, descending', more: 'Show more' },
    es: { selected: '{n} seleccionados', selectedOne: '{n} seleccionado', deselect: 'Deseleccionar', selectAll: 'Seleccionar todos', selectRow: 'Seleccionar fila', selectRowName: 'Seleccionar {name}', range: '{from}–{to} de {total}', prev: 'Página anterior', next: 'Página siguiente', emptyTitle: 'Sin resultados', emptyText: 'Prueba a cambiar los filtros.', sortBy: 'Ordenar por', sortNone: 'Orden inicial', ascending: '{col}, ascendente', descending: '{col}, descendente', more: 'Mostrar más' } };
  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var L = useCompLabels(DATATABLE_TEXTS, p.labels);
    var loc = p.locale, nf = null;
    if (loc) try { nf = new Intl.NumberFormat(loc); } catch (e) { loc = null; } /* una lingua che il browser non conosce non rompe la tabella: si usa la forma italiana */
    var num = nf ? function (v) { return nf.format(v); } : fmtNum;
    function fill(t, k, v) { return t.replace(k, function () { return v; }); } /* il testo del modulo entra com'è, anche con «$&» */
    /* ordine e selezione li può tenere la pagina (sort/onSort, selected/onSelect): allora la tabella mostra le righe come arrivano, già ordinate dal server, e chiede (richiesta 203) */
    var so = useState(p.defaultSort || null), sortOwn = p.sort !== undefined, sort = sortOwn ? p.sort : so[0];
    function setSort(v) { if (!sortOwn) so[1](v); if (p.onSort) p.onSort(v); }
    var se = useState([]), selOwn = p.selected !== undefined, sel = selOwn ? p.selected || [] : se[0];
    function setSel(n) { if (!selOwn) se[1](n); if (p.onSelect) p.onSelect(n); }
    var pg = useState(0), page = pg[0], setPage = pg[1];
    var more = !!p.onMore; /* con onMore le righe arrivano a blocchi: si mostrano tutte, niente pagine */
    var size = p.pageSize || 8, from = more ? 0 : page * size;
    var sorted = rows.slice();
    if (sort && !sortOwn) {
      var c = cols.find(function (x) { return x.key === sort.key; });
      var get = (c && c.sortValue) || function (r) { return r[sort.key]; };
      sorted.sort(function (a, b) { var x = get(a), y = get(b); var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), loc || 'it'); return sort.dir === 'asc' ? r : -r; });
    }
    var pages = more ? 1 : Math.max(1, Math.ceil(sorted.length / size));
    var shown = more ? sorted : sorted.slice(from, from + size), total = p.total != null ? p.total : rows.length;
    var rid = function (r, i) { return r.id != null ? r.id : i; };
    var allOn = shown.length > 0 && shown.every(function (r, i) { return sel.indexOf(rid(r, i)) >= 0; });
    function all() { var ids = shown.map(rid), n = allOn ? sel.filter(function (x) { return ids.indexOf(x) < 0; }) : Array.from(new Set(sel.concat(ids))); setSel(n); } /* anche «Seleziona tutti» lo dice al modulo, come la casella di una riga */
    var off = !!p.selectionDisabled; /* durante un'operazione sulle righe scelte la selezione non cambia: caselle e «Deseleziona» spenti (richiesta 215) */
    /* una riga sola: «1 selezionato»; se la pagina ha dato solo il suo «selected», resta quello (richiesta 214) */
    var selText = sel.length === 1 && !(p.labels && p.labels.selected && !p.labels.selectedOne) ? L.selectedOne : L.selected;
    function rowLabel(r) { var n = p.rowName ? p.rowName(r) : null; return (n || n === 0) && !(p.labels && p.labels.selectRow && !p.labels.selectRowName) ? fill(L.selectRowName, '{name}', String(n)) : L.selectRow; } /* «Seleziona Mario Rossi»: il lettore di schermo distingue le righe (richiesta 213) */
    function toggle(id) { var n = sel.indexOf(id) >= 0 ? sel.filter(function (x) { return x !== id; }) : sel.concat([id]); setSel(n); }
    var sortCols = cols.filter(function (c) { return c.sortable !== false; });
    var sortOpts = (sort ? [] : [{ value: '', label: L.sortNone }]).concat([].concat.apply([], sortCols.map(function (c) {
      return [{ value: c.key + ':asc', label: fill(L.ascending, '{col}', c.label || c.srLabel || '') }, { value: c.key + ':desc', label: fill(L.descending, '{col}', c.label || c.srLabel || '') }];
    })));
    return h('div', { className: 'zr-table-wrap' },
      p.selectable && sel.length ? h('div', { className: 'zr-bulk' }, h('strong', null, fill(selText, '{n}', num(sel.length))), p.bulkActions || null,
        h(Button, { variant: 'ghost', size: 'sm', disabled: off, onClick: function () { setSel([]); } }, L.deselect)) : null,
      sortCols.length && rows.length > 1 ? h(Field, { className: 'zr-table-sortbar', label: L.sortBy, options: sortOpts, value: sort ? sort.key + ':' + sort.dir : '',
        onChange: function (e) { var v = e.target.value.split(':'); setSort(v[0] ? { key: v[0], dir: v[1] } : null); setPage(0); } }) : null,
      p.selectable && shown.length ? h('div', { className: 'zr-table-selectall' }, h(Checkbox, { label: L.selectAll, checked: allOn, disabled: off, onChange: all })) : null, /* sotto 720 px l'intestazione è nascosta: «Seleziona tutti» sta qui */
      h('div', { className: 'zr-table-scroll' },
        h('table', { className: cx('zr-table', p.stickyFirst && 'is-sticky-first') }, /* stickyFirst: la prima colonna (con la casella) resta ferma quando la tabella scorre di lato */
          h('thead', null, h('tr', null,
            p.selectable ? h('th', { className: 'zr-td-check' }, h(Checkbox, { 'aria-label': L.selectAll, checked: allOn, disabled: off, onChange: all })) : null,
            cols.map(function (c, k) {
              var active = sort && sort.key === c.key;
              return h('th', { key: c.key, className: cx(c.align === 'right' && 'is-right', !k && 'zr-td-first'), style: c.width || c.minWidth ? { width: c.width, minWidth: c.minWidth } : undefined, 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined },
                c.sortable === false ? (c.label || (c.srLabel ? h('span', { className: 'zr-visually-hidden' }, c.srLabel) : null)) : h('button', { type: 'button', className: cx('zr-th-sort', active && 'is-active'), onClick: function () { setSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' }); } }, c.label || (c.srLabel ? h('span', { className: 'zr-visually-hidden' }, c.srLabel) : null), h(Icon, { name: active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort', size: 14 })));
            }))),
          h('tbody', null, shown.length ? shown.map(function (r, i) {
            var id = rid(r, from + i), on = sel.indexOf(id) >= 0;
            return h('tr', { key: id, className: cx(on && 'is-selected', p.onRowClick && 'is-clickable'), onClick: p.onRowClick ? function () { p.onRowClick(r); } : undefined },
              p.selectable ? h('td', { className: 'zr-td-check', onClick: function (e) { e.stopPropagation(); } }, h(Checkbox, { 'aria-label': rowLabel(r), checked: on, disabled: off, onChange: function () { toggle(id); } })) : null,
              cols.map(function (c, k) { return h('td', { key: c.key, 'data-label': typeof c.label === 'string' && c.label ? c.label : c.srLabel, /* la colonna senza titolo visibile (il ⋯) ha comunque un nome (richiesta 15) */ className: cx(c.align === 'right' && 'is-right', !k && 'zr-td-first') }, c.render ? c.render(r) : r[c.key]); }));
          }) : h('tr', null, h('td', { colSpan: cols.length + (p.selectable ? 1 : 0) }, p.empty || h(EmptyState, { compact: true, icon: 'search', title: L.emptyTitle, text: L.emptyText })))))),
      more && rows.length ? h('div', { className: 'zr-pager' }, /* le righe a blocchi: quante sono arrivate sul totale vero, detto quando cambia, e «Mostra altri» finché ne mancano */
        h('span', { 'aria-live': 'polite' }, fill(fill(fill(L.range, '{from}', num(1)), '{to}', num(rows.length)), '{total}', num(Math.max(total, rows.length)))),
        rows.length < total ? h(Button, { variant: 'secondary', size: 'sm', busy: p.loadingMore, onClick: p.onMore }, L.more) : null) :
      pages > 1 ? h('div', { className: 'zr-pager' },
        h('span', null, fill(fill(fill(L.range, '{from}', num(page * size + 1)), '{to}', num(Math.min(sorted.length, page * size + size))), '{total}', num(sorted.length))),
        h('div', null,
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevronLeft', 'aria-label': L.prev, disabled: page === 0, onClick: function () { setPage(page - 1); } }),
          h(Button, { variant: 'secondary', size: 'sm', icon: 'chevron', 'aria-label': L.next, disabled: page >= pages - 1, onClick: function () { setPage(page + 1); } }))) : null);
  }

  function FilterBar(p) {
    var id = useId('flt');
    /* il nome del campo e la frase d'aiuto legata li dà il modulo, nella sua lingua (richieste 173 e 19) */
    var search = p.search !== false ? h('label', { className: 'zr-input has-icon zr-filter-search' }, h(Icon, { name: 'search', size: 16 }),
      h('input', { type: 'search', placeholder: p.searchPlaceholder || 'Cerca…', 'aria-label': p.searchLabel || 'Cerca', 'aria-describedby': p.searchHint ? id + '-h' : undefined, value: p.query, onChange: p.onQuery ? function (e) { p.onQuery(e.target.value); } : undefined })) : null;
    /* compact: al telefono i filtri stanno in una riga che scorre e lasciano spazio alle liste (richiesta 51) */
    return h('div', { className: cx('zr-filterbar', p.compact && 'is-compact') },
      search && p.searchHint ? h('div', { className: 'zr-filter-search-wrap' }, search, h('p', { id: id + '-h', className: 'zr-filter-hint' }, p.searchHint)) : search,
      p.compact ? h('div', { className: 'zr-filter-items' }, p.children) : p.children,
      p.actions ? h('div', { className: 'zr-filter-actions' }, p.actions) : null);
  }

  /* ---------- ReorderList: un elenco che si riordina trascinando, o coi pulsanti «Sposta su» e «Sposta giù» (richiesta 25) ---------- */
  var REORDER_LABELS = { up: 'Sposta su', down: 'Sposta giù', moved: '{item}: posizione {n} di {total}' };
  var REORDER_TEXTS = { it: REORDER_LABELS,
    en: { up: 'Move up', down: 'Move down', moved: '{item}: position {n} of {total}' },
    es: { up: 'Subir', down: 'Bajar', moved: '{item}: posición {n} de {total}' } };
  function ReorderList(p) {
    var L = useCompLabels(REORDER_TEXTS, p.labels), items = p.items || [];
    var ms = useState(''), said = ms[0], say = ms[1];
    var dg = useState(null), drag = dg[0], setDrag = dg[1];
    var listRef = useRef(null), want = useRef(null), dragRef = useRef(null);
    function fill(t, k, v) { return t.replace(k, function () { return v; }); }
    function nameOf(it) { return typeof it.label === 'string' || typeof it.label === 'number' ? String(it.label) : String(it.id); }
    function move(from, to, how) {
      if (from === to || to < 0 || to >= items.length) return;
      var n = items.slice(), it = n.splice(from, 1)[0]; n.splice(to, 0, it);
      say(fill(fill(fill(L.moved, '{item}', nameOf(it)), '{n}', String(to + 1)), '{total}', String(n.length)));
      want.current = how ? { id: String(it.id), how: how } : null;
      if (p.onChange) p.onChange(n);
    }
    useEffect(function () { /* la riga spostata coi pulsanti si porta dietro il fuoco; all'estremo passa all'altro pulsante */
      var w = want.current, u = listRef.current; if (!w || !u) return; want.current = null;
      var li = [].filter.call(u.children, function (x) { return x.getAttribute('data-id') === w.id; })[0], b = li && li.querySelector('[data-move="' + w.how + '"]');
      if (b && b.getAttribute('aria-disabled') === 'true') b = li.querySelector('[data-move="' + (w.how === 'up' ? 'down' : 'up') + '"]');
      if (b) b.focus();
    });
    function grab(e, i) {
      if (e.button > 0 || items.length < 2) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* senza cattura si segue lo stesso */ }
      var rows = [].map.call(listRef.current.children, function (x) { var r = x.getBoundingClientRect(); return { top: r.top, h: r.height }; });
      dragRef.current = { i: i, to: i, y0: e.clientY, dy: 0, rows: rows, pid: e.pointerId }; setDrag(dragRef.current);
    }
    function follow(e) {
      var d = dragRef.current; if (!d || e.pointerId !== d.pid) return;
      var dy = e.clientY - d.y0, r = d.rows[d.i], mid = r.top + r.h / 2 + dy, to = 0;
      d.rows.forEach(function (x, k) { if (k !== d.i && mid > x.top + x.h / 2) to++; });
      dragRef.current = Object.assign({}, d, { dy: dy, to: to }); setDrag(dragRef.current);
    }
    function drop() { var d = dragRef.current; if (!d) return; dragRef.current = null; setDrag(null); move(d.i, d.to, null); }
    function cancel() { dragRef.current = null; setDrag(null); }
    useEffect(function () { /* Esc mentre si trascina lascia tutto com'era, e resta suo */
      if (!drag) return;
      function k(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }
      document.addEventListener('keydown', k, true); return function () { document.removeEventListener('keydown', k, true); };
    }, [!!drag]);
    function shift(k) {
      if (!drag) return 0;
      if (k === drag.i) return drag.dy;
      var hd = drag.rows[drag.i].h;
      return drag.i < k && k <= drag.to ? -hd : drag.to <= k && k < drag.i ? hd : 0;
    }
    return h('div', { className: cx('zr-reorder-wrap', p.className) },
      h('ul', { ref: listRef, className: cx('zr-reorder', drag && 'is-dragging'), 'aria-label': p['aria-label'] },
        items.map(function (it, k) {
          var y = shift(k), last = k === items.length - 1;
          function mv(dir, off, to) {
            return h(Button, { variant: 'ghost', size: 'sm', icon: dir === 'up' ? 'chevronUp' : 'chevronDown', 'data-move': dir, 'aria-label': (dir === 'up' ? L.up : L.down) + ': ' + nameOf(it),
              'aria-disabled': off ? true : undefined, onClick: function () { if (!off) move(k, to, dir); } });
          }
          return h('li', { key: it.id, 'data-id': it.id, className: cx('zr-reorder-item', drag && drag.i === k && 'is-dragging'), style: y ? { transform: 'translateY(' + y + 'px)' } : undefined },
            h('span', { className: 'zr-reorder-handle', 'aria-hidden': true, onPointerDown: function (e) { grab(e, k); }, onPointerMove: follow, onPointerUp: drop, onPointerCancel: cancel }, h(Icon, { name: 'menu', size: 18 })),
            h('div', { className: 'zr-reorder-body' }, p.render ? p.render(it) : [h('div', { key: 'l', className: 'zr-reorder-label' }, it.label), it.description ? h('div', { key: 'd', className: 'zr-reorder-desc' }, it.description) : null]),
            h('div', { className: 'zr-reorder-moves' }, mv('up', k === 0, k - 1), mv('down', last, k + 1)));
        })),
      h('p', { className: 'zr-visually-hidden zr-reorder-live', 'aria-live': 'polite' }, said));
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
            var step = s.step !== undefined ? s.step : p.step; /* a gradino: orizzontale fino al punto dopo, poi il salto */
            var d = s.data.map(function (v, i) { return !i ? 'M' + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1) : step ? 'H' + xAt(i).toFixed(1) + ' V' + yAt(v).toFixed(1) : 'L' + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1); }).join(' ');
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

  function ChartCard(p) {
    return h('section', { className: cx('zr-panel', p.className) },
      h('header', { className: 'zr-panel-head' }, h('div', null, h(p.headingLevel === 3 ? 'h3' : p.headingLevel === 4 ? 'h4' : 'h2', null, p.title), p.subtitle ? h('p', null, p.subtitle) : null), p.actions ? h('div', { className: 'zr-panel-actions' }, p.actions) : null),
      h('div', { className: 'zr-panel-body' }, p.children));
  }

  /* ---------- CRM ---------- */
  var STATUS_TONE = { Lead: 'sky', Qualificato: 'plum', Cliente: 'pine', Perso: 'neutral', Attiva: 'pine', 'In pausa': 'citrus', Bozza: 'neutral', Errore: 'coral' };
  function StatusLabel(p) { return h(Label, { tone: p.tone || STATUS_TONE[p.status] || 'neutral' }, p.status); }

  function RecordHeader(p) {
    return h('header', { className: 'zr-record' },
      h(Avatar, { name: p.name, size: 'lg' }),
      h('div', { className: 'zr-record-main' },
        h('div', { className: 'zr-record-title' }, h('h1', null, p.name), p.status ? h(StatusLabel, { status: p.status, tone: p.statusTone }) : null), /* statusTone come tone nelle liste (richiesta 174) */
        p.subtitle ? h('p', null, p.subtitle) : null,
        p.meta ? h('ul', { className: 'zr-record-meta' }, p.meta.map(function (m) { return h('li', { key: m.text }, h(Icon, { name: m.icon, size: 14 }), m.href ? h('a', { href: m.href }, m.text) : m.text); })) : null),
      p.actions ? h('div', { className: 'zr-page-actions' }, p.actions) : null);
  }

  var ACT_ICON = { email: ['mail', 'sky'], call: ['phone', 'pine'], meeting: ['users', 'pine'], message: ['message', 'sky'], note: ['edit', 'citrus'], deal: ['euro', 'plum'], task: ['checklist', 'neutral'], automation: ['bolt', 'plum'] };
  function ActivityTimeline(p) {
    return h('ol', { className: 'zr-timeline' }, (p.items || []).map(function (it, i) {
      var ic = ACT_ICON[it.type] || ['info', 'neutral'];
      return h('li', { key: it.id != null ? it.id : i },
        h('span', { className: cx('zr-iconbox', 'zr-iconbox-xs', 'zr-label-' + ic[1]) }, h(Icon, { name: ic[0], size: 14 })),
        h('div', { className: 'zr-tl-body' },
          h('div', { className: 'zr-tl-head' }, h('strong', null, it.title), h('time', null, it.time)),
          it.outcome ? h('div', { className: 'zr-tl-outcome' }, h(Label, { tone: it.outcomeTone || 'neutral' }, it.outcome)) : null,
          it.edit ? h('div', { className: 'zr-tl-edit' }, it.edit) : it.text ? h('p', null, it.text) : null,
          it.by ? h('span', { className: 'zr-tl-by' }, it.by) : null,
          it.actions && it.actions.length && !it.edit ? h('div', { className: 'zr-tl-actions' }, it.actions.map(function (a, j) {
            return h(Button, { key: j, variant: a.tone === 'danger' ? 'danger' : 'ghost', size: 'sm', icon: a.icon, disabled: a.disabled, 'aria-label': a.label + ': ' + it.title, onClick: a.onClick }, a.label);
          })) : null));
    }));
  }

  function DescriptionList(p) {
    return h('dl', { className: 'zr-dl' }, (p.items || []).map(function (it) { return h('div', { key: it.label }, h('dt', null, it.label), h('dd', null, it.value)); }));
  }

  function dealMoney(p) { if (p.formatAmount) try { return p.formatAmount(p.amount); } catch (e) {} return fmtMoney(p.amount, p.currency); }
  function DealCard(p) {
    var rest = omit(p, ['title', 'company', 'companyIcon', 'amount', 'amountText', 'formatAmount', 'currency', 'owner', 'probability', 'age', 'ageLabel', 'ageTitle', 'dragging', 'className', 'actions', 'actionsLabel', 'busy']);
    var cIcon = p.companyIcon === undefined ? 'building' : p.companyIcon;
    var ms = useState(false), menu = ms[0], btn = useRef(null), kb = useRef(false);
    var acts = p.actions && p.actions.length && !p.busy ? p.actions : null, name = p.actionsLabel || KANBAN_TEXTS.cardActions;
    /* il «⋯» delle azioni, come in KanbanCard (richiesta 157): fuori dal Tab, dalla scheda con «.», Maiusc+F10 o il tasto Menu; al tocco su 44 px (richiesta 1) */
    if (acts) rest.onKeyDown = function (e) {
      if (e.target === e.currentTarget && (e.key === '.' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); kb.current = true; ms[1](true); return; }
      if (p.onKeyDown) p.onKeyDown(e);
    };
    /* busy: lo spostamento aspetta il modulo; la scheda si vede occupata e non si trascina */
    if (p.busy) rest = Object.assign(rest, { 'aria-busy': true, draggable: false });
    var card = h('article', Object.assign({ tabIndex: 0, 'aria-keyshortcuts': acts ? '. Shift+F10' : undefined }, rest, { className: cx('zr-card zr-deal', p.dragging && 'is-dragging', acts && 'has-actions', acts && !p.owner && 'is-ownerless', p.busy && 'is-busy', p.className) }),
      acts ? h('button', { ref: btn, type: 'button', tabIndex: -1, draggable: false, className: 'zr-card-actions', 'aria-label': name, 'aria-haspopup': 'menu', 'aria-expanded': menu,
        onMouseDown: function (e) { e.stopPropagation(); }, onClick: function (e) { e.stopPropagation(); kb.current = false; ms[1](!menu); } }, h(Icon, { name: 'more', size: 16 })) : null,
      h('div', { className: 'zr-deal-top' }, p.company ? h('span', { className: 'zr-deal-company' }, cIcon ? h(Icon, { name: cIcon, size: 14 }) : null, p.company) : h('span', null),
        p.busy ? h('span', { className: 'zr-btn-spin zr-deal-spin', 'aria-hidden': true }) : p.owner ? h(Avatar, { name: p.owner, size: 'sm' }) : null),
      h('h4', { className: 'zr-card-title' }, p.title),
      h('div', { className: 'zr-deal-foot' },
        h('strong', { className: 'zr-deal-amount' }, p.amountText != null ? p.amountText : dealMoney(p)), /* l'importo già scritto dal modulo, nella sua valuta e lingua (richiesta 68) */
        h('span', { className: 'zr-card-meta' }, p.probability != null ? h('span', { className: 'zr-meta' }, h(Icon, { name: 'target', size: 14 }), p.probability + '%') : null,
          p.age ? h('span', { className: cx('zr-meta', p.age > 14 && 'is-overdue'), title: p.ageTitle || 'Giorni in questa fase' }, h(Icon, { name: 'clock', size: 14 }), p.age + ' ' + (p.ageLabel || 'gg')) : null)));
    return acts ? h(React.Fragment, null, card, menu ? h(Menu, { anchor: btn.current, align: 'end', label: name, items: acts, onClose: function () { ms[1](false); var a = kb.current && btn.current && btn.current.parentNode, b = btn.current; if (a) queueMicrotask(function () { var x = document.activeElement; if (document.contains(a) && (!x || x === document.body || x === b)) a.focus(); }); } }) : null) : card;
  }

  var SAMPLE_STAGES = [
    { id: 'new', title: 'Nuovo lead', deals: [{ id: 'd1', title: 'Corso Leadership · 12 posti', company: 'Rossi Logistica', amount: 7200, owner: 'Luciano Castro', probability: 10, age: 2 }, { id: 'd2', title: 'Formazione PM interna', company: 'Studio Bianchi', amount: 3400, owner: 'Giulia Bianchi', probability: 10, age: 5 }] },
    { id: 'qual', title: 'Qualificato', deals: [{ id: 'd3', title: 'Certificazione PMP ×4', company: 'Nexa Srl', amount: 9800, owner: 'Marco Neri', probability: 30, age: 9 }] },
    { id: 'prop', title: 'Proposta', deals: [{ id: 'd4', title: 'Percorso manager 2027', company: 'Alfa Costruzioni', amount: 18500, owner: 'Luciano Castro', probability: 55, age: 18 }, { id: 'd5', title: 'Coaching team vendite', company: 'Verdi & Figli', amount: 4200, owner: 'Giulia Bianchi', probability: 50, age: 4 }] },
    { id: 'neg', title: 'Negoziazione', deals: [{ id: 'd6', title: 'Academy aziendale', company: 'Orion Spa', amount: 26000, owner: 'Marco Neri', probability: 75, age: 7 }] },
    { id: 'won', title: 'Vinto', deals: [{ id: 'd7', title: 'Workshop Agile', company: 'Blu Digital', amount: 2900, owner: 'Luciano Castro', probability: 100, age: 1 }] }
  ];
  /* sposta una trattativa nella fase `to`, alla posizione `at` (in fondo se -1); numero e totali passati dal modulo seguono lo spostamento (richiesta 1) */
  function dealMove(list, id, to, at, put) {
    var deal = null, from = null;
    if (!list.some(function (s) { return s.id === to; })) return list;
    var n = list.map(function (s) { var ds = s.deals.filter(function (d) { if (d.id === id) { deal = d; from = s.id; return false; } return true; }); return ds.length === s.deals.length ? s : Object.assign({}, s, { deals: ds }); });
    if (!deal || from === to) return list;
    var x = put || deal, a = x.amount || 0, w = a * (x.probability || 0) / 100;
    function shift(s, k) { var o = Object.assign({}, s); if (o.count != null) o.count += k; if (o.total != null) o.total += k * a; if (o.weighted != null) o.weighted += k * w; return o; }
    return n.map(function (s) {
      if (s.id === from) return shift(s, -1);
      if (s.id !== to) return s;
      var o = shift(s, 1), ds = s.deals.slice(); if (at >= 0 && at < ds.length) ds.splice(at, 0, x); else ds.push(x); o.deals = ds; return o;
    });
  }
  function dealStageOf(list, id) { var r = null; list.forEach(function (s) { s.deals.forEach(function (d, i) { if (d.id === id) r = { stage: s.id, index: i, deal: d }; }); }); return r; }
  function DealPipeline(p) {
    var st = useState(function () { return JSON.parse(JSON.stringify(p.stages || SAMPLE_STAGES)); }), stages = st[0], setStages = st[1];
    var cur = useRef(stages); cur.current = stages;
    var dg = useState(null), drag = dg[0], setDrag = dg[1];
    var ov = useState(null), over = ov[0], setOver = ov[1];
    var pd = useState({}), busy = pd[0], setBusy = pd[1], pend = useRef({});
    var lv = useState(''), said = lv[0], setSaid = lv[1];
    var pm = useState(false), plMenu = pm[0], plBtn = useRef(null);
    var root = useRef(null), refocus = useRef(null), lastStages = useRef(null), live = useRef(true);
    var adj = useRef({ open: 0, weighted: 0 }), lastTotals = useRef(undefined);
    var L = Object.assign({ overline: 'CRM', title: 'Pipeline vendite', open: 'Aperte', weighted: 'Ponderate', filter: 'Filtra', newDeal: 'Nuova trattativa', total: 'Totale', stageWeighted: 'Ponderato', more: 'Mostra altre', seeAll: 'Vedi tutte', openDeal: 'Apri', moveTo: 'Sposta in {stage}', moved: '{deal} spostata in {stage}', back: '{deal} resta in {stage}', dealActions: 'Azioni rapide', pipeline: 'Pipeline' }, p.labels || {});
    React.useEffect(function () { live.current = true; return function () { live.current = false; }; }, []);
    function kindOf(s) { return s.kind || (s.id === 'won' ? 'won' : s.id === 'lost' ? 'lost' : 'open'); }
    function set(n) { cur.current = n; setStages(n); }
    /* lo stesso testo detto due volte si sente due volte */
    function say(x) { setSaid(function (v) { return v === x ? x + '\u00a0' : x; }); }
    /* quanto cambiano aperte e ponderate della testa se la trattativa passa da una fase all'altra */
    function delta(list, deal, from, to) {
      var k = {}; list.forEach(function (s) { k[s.id] = kindOf(s); });
      var g = (k[to] === 'open' ? 1 : 0) - (k[from] === 'open' ? 1 : 0), a = deal.amount || 0;
      return { open: g * a, weighted: g * a * (deal.probability || 0) / 100 };
    }
    function bump(d, k) { adj.current = { open: adj.current.open + k * d.open, weighted: adj.current.weighted + k * d.weighted }; }
    function keep() { var a = document.activeElement; if (!a || !root.current || !root.current.contains(a)) return null; var m = a.getAttribute('data-more'); return { el: a, id: a.getAttribute('data-deal-id'), more: m, n: m ? (cur.current.filter(function (s) { return s.id === m; })[0] || { deals: [] }).deals.length : 0 }; }
    /* stages controllata: il modulo la rinnova (anche ogni 20 s); gli spostamenti che aspettano il modulo restano dove sono, e il fuoco resta dov'era (richiesta 1) */
    React.useEffect(function () {
      if (!p.stages) return;
      var j = JSON.stringify(p.stages);
      if (lastStages.current === null) { lastStages.current = j; return; }
      if (j === lastStages.current) return;
      lastStages.current = j;
      var n = JSON.parse(j);
      Object.keys(pend.current).forEach(function (id) { var w = dealStageOf(n, id), to = pend.current[id].to; if (w && w.stage !== to) n = dealMove(n, id, to, -1, Object.assign({}, w.deal, { age: 0 })); });
      /* il fuoco chiesto da uno spostamento (il modulo che rimanda onChange come stages) vale per le fasi nuove; altrimenti si tiene dov'è */
      var k = keep(); if (k) refocus.current = k; if (refocus.current) refocus.current.for = n; set(n);
    }, [p.stages]);
    /* i totali della testa dal modulo: le correzioni degli spostamenti valgono finché non arrivano totali nuovi; da lì restano solo quelle degli spostamenti che aspettano ancora il modulo */
    var tj = JSON.stringify(p.totals || null);
    if (lastTotals.current !== tj) { if (lastTotals.current !== undefined) { adj.current = { open: 0, weighted: 0 }; Object.keys(pend.current).forEach(function (id) { bump(pend.current[id].d, 1); }); } lastTotals.current = tj; }
    React.useEffect(function () {
      var r = refocus.current; if (!r || !root.current || r.for && r.for !== stages) return; refocus.current = null; /* aspetta il disegno con le fasi per cui è stato chiesto */
      var a = document.activeElement; if (a && a !== document.body && document.contains(a)) return;
      if (r.el && document.contains(r.el)) { r.el.focus(); return; }
      var cards = Array.prototype.slice.call(root.current.querySelectorAll('[data-deal-id]'));
      if (r.id) { cards.forEach(function (el) { if (el.getAttribute('data-deal-id') === r.id) el.focus(); }); return; }
      /* «Mostra altre» sparito con l'ultima pagina: il fuoco va alla prima scheda arrivata, o all'ultima della fase */
      if (r.more) { var col = root.current.querySelector('[data-stage="' + r.more.replace(/["\\]/g, '') + '"]'), cs = col ? col.querySelectorAll('[data-deal-id]') : []; var t = cs[r.n] || cs[cs.length - 1]; if (t) t.focus(); }
    });
    var cy = p.currency || 'EUR';
    function money(v, round) { if (p.formatAmount) try { return p.formatAmount(v); } catch (e) {} return fmtMoney(round ? Math.round(v) : v, cy); } /* totali e ponderati scritti dal modulo, nella sua valuta e lingua (richiesta 190); se la sua funzione sbaglia, come prima */
    function stageTitle(id) { var s = cur.current.filter(function (x) { return x.id === id; })[0]; return s ? s.title : ''; }
    function told(k, deal, id) { return textOf(textOf(L[k], '{deal}', deal.title), '{stage}', stageTitle(id)); }
    /* spostare: trascinando, o con «Sposta in…» dal «⋯». onMove può fermarlo: false lo ferma prima, una Promise rifiutata o risolta a false riporta la scheda dov'era */
    function move(id, to, keys) {
      var w = dealStageOf(cur.current, id);
      if (!w || w.stage === to || pend.current[id] || !cur.current.some(function (s) { return s.id === to; })) return;
      var r; if (p.onMove) { try { r = p.onMove(w.deal, to, w.stage); } catch (e) { r = false; } }
      if (r === false) { if (keys) say(told('back', w.deal, w.stage)); return; }
      var d = delta(cur.current, w.deal, w.stage, to);
      var n = dealMove(cur.current, id, to, -1, Object.assign({}, w.deal, { age: 0 }));
      if (keys) refocus.current = { id: id, for: n };
      bump(d, 1); set(n); if (p.onChange) p.onChange(n);
      if (keys) say(told('moved', w.deal, to));
      if (!r || typeof r.then !== 'function') return;
      pend.current[id] = { to: to, d: d }; setBusy(Object.assign({}, pend.current));
      function end(ok) {
        if (!live.current) return; /* smontata nel frattempo (un'altra pipeline): niente più onChange */
        delete pend.current[id]; setBusy(Object.assign({}, pend.current));
        if (ok !== false) return;
        var now = dealStageOf(cur.current, id); if (!now) return;
        var a = document.activeElement, mine = !a || a === document.body || a.getAttribute('data-deal-id') === id;
        var m = dealMove(cur.current, id, w.stage, w.index, Object.assign({}, now.deal, { age: w.deal.age }));
        if (m === cur.current) return;
        if (mine) refocus.current = { id: id, for: m };
        bump(delta(cur.current, now.deal, now.stage, w.stage), 1); set(m); if (p.onChange) p.onChange(m);
        if (mine || keys) say(told('back', w.deal, w.stage));
      }
      r.then(end, function () { end(false); });
    }
    /* un numero che non si conosce non si mostra: con una parte delle trattative (hasMore, count) la somma di quelle caricate sarebbe sbagliata */
    function partial(s) { return s.hasMore || s.count != null && s.count !== s.deals.length; }
    function sumOf(s) { return s.total != null ? s.total : partial(s) ? null : s.deals.reduce(function (b, d) { return b + (d.amount || 0); }, 0); }
    function weightOf(s) { return s.weighted != null ? s.weighted : partial(s) ? null : s.deals.reduce(function (b, d) { return b + (d.amount || 0) * (d.probability || 0) / 100; }, 0); }
    function add(a, b) { return a == null || b == null ? null : a + b; }
    var openStages = stages.filter(function (s) { return kindOf(s) === 'open'; });
    var T = p.totals || {};
    var total = T.open != null ? T.open + adj.current.open : openStages.reduce(function (a, s) { return add(a, sumOf(s)); }, 0);
    var weighted = T.weighted != null ? T.weighted + adj.current.weighted : openStages.reduce(function (a, s) { return add(a, weightOf(s)); }, 0);
    var sub = [total != null ? L.open + ' ' + money(total) : null, weighted != null ? L.weighted + ' ' + money(weighted, true) : null].filter(Boolean).join(' · ');
    /* più pipeline (piano Team): il menu accanto alle azioni, solo se ce n'è più d'una */
    var pls = p.pipelines || [], pl = pls.filter(function (x) { return x.id === p.pipelineId; })[0] || pls[0];
    var plPick = pls.length > 1 ? h('button', { key: 'p', ref: plBtn, type: 'button', className: 'zr-btn zr-btn-secondary zr-btn-sm zr-deal-pipeline', 'aria-haspopup': 'menu', 'aria-expanded': plMenu, 'aria-label': L.pipeline + ': ' + pl.name, onClick: function () { pm[1](!plMenu); } },
      h('span', null, pl.name), h(Icon, { name: 'chevronDown', size: 16 })) : null;
    var actions = [plPick, h(Button, { key: 'f', variant: 'secondary', size: 'sm', icon: 'filter', onClick: p.onFilter }, L.filter), h(Button, { key: 'n', size: 'sm', icon: 'plus', onClick: p.onNew }, L.newDeal)];
    return h('div', { ref: root, className: 'zr-board' },
      h('div', { className: 'zr-board-head zr-board-head-plain' },
        h(PageHeader, { overline: L.overline, title: p.title || L.title, subtitle: sub || undefined, actions: actions })),
      plMenu && plPick ? h(Menu, { anchor: plBtn.current, align: 'end', label: L.pipeline, onClose: function () { pm[1](false); },
        items: pls.map(function (x) { return { label: x.name, checked: x.id === pl.id, onClick: function () { if (x.id !== pl.id && p.onPipeline) p.onPipeline(x.id); } }; }) }) : null,
      h('span', { className: 'zr-visually-hidden', 'aria-live': 'polite' }, said),
      h('div', { className: 'zr-lanes' }, stages.map(function (s) {
        var k = kindOf(s), sum = sumOf(s), wsum = weightOf(s);
        var more = s.hasMore && p.onMore ? h(Button, { key: 'more', variant: 'ghost', size: 'sm', className: 'zr-col-more', 'data-more': s.id, busy: !!s.loadingMore, onClick: function () { p.onMore(s.id); } }, L.more) : null;
        return h(KanbanColumn, { key: s.id, 'data-stage': s.id, title: s.title, count: s.count != null ? s.count : s.hasMore ? s.deals.length + '+' : s.deals.length, isOver: over === s.id && drag, className: k === 'won' ? 'is-won' : undefined,
          onDragOver: function (e) { e.preventDefault(); if (over !== s.id) setOver(s.id); },
          onDrop: function (e) { e.preventDefault(); if (drag) move(drag, s.id); setDrag(null); setOver(null); },
          composer: h('div', { className: 'zr-col-sums' },
            sum != null ? h('div', { className: 'zr-col-sum' }, h('span', null, L.total), h('strong', null, money(sum))) : null,
            k === 'open' && wsum != null ? h('div', { className: cx('zr-col-sum', sum != null && 'is-sub') }, h('span', null, L.stageWeighted), h('strong', null, money(wsum, true))) : null,
            k !== 'open' && p.onSeeAll ? h(Button, { variant: 'ghost', size: 'sm', className: 'zr-col-see', onClick: function () { p.onSeeAll(s.id); } }, L.seeAll) : null) },
          s.deals.map(function (d) {
            var acts = (p.onOpen ? [{ label: L.openDeal, onClick: function () { p.onOpen(d); } }, { sep: true }] : []).concat(stages.filter(function (x) { return x.id !== s.id; }).map(function (x) { return { label: textOf(L.moveTo, '{stage}', x.title), onClick: function () { move(d.id, x.id, true); } }; }));
            var extra = p.dealActions ? p.dealActions(d) || [] : [];
            if (extra.length) acts = acts.concat([{ sep: true }], extra);
            /* la scheda non è un role="button": dentro c'è il «⋯», che deve restare raggiungibile; «Apri» sta anche nel menu */
            return h(DealCard, Object.assign({ key: d.id, companyIcon: p.companyIcon, currency: cy, formatAmount: p.formatAmount, ageLabel: p.labels && p.labels.days, ageTitle: p.labels && p.labels.daysTitle }, d, { 'data-deal-id': d.id, busy: !!busy[d.id], actions: acts, actionsLabel: L.dealActions + ': ' + d.title,
              draggable: true, dragging: drag === d.id, onDragStart: function (e) { setDrag(d.id); try { e.dataTransfer.setData('text/plain', d.id); } catch (x) {} }, onDragEnd: function () { setDrag(null); setOver(null); },
              onClick: p.onOpen ? function () { p.onOpen(d); } : undefined,
              onKeyDown: p.onOpen ? function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onOpen(d); } } : undefined })); }).concat(more ? [more] : []));
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
    var C = useLabels();
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
          h('header', { className: 'zr-panel-head' }, h('h2', null, 'Configura passo'), h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: function () { setSel(null); } })),
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
      open + t + '. Abbiamo raccolto quello che serve per partire con il piede giusto, senza giri di parole.',
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
    var ref = useRef(null), mid = useId('mnu'), last = useRef(p); last.current = p; /* Esc legge le props di adesso (returnFocus arrivato dopo l'apertura) */
    React.useEffect(function () {
      function close(e) { if (ref.current && !ref.current.contains(e.target) && e.target !== p.anchor && !(p.anchor && p.anchor.contains && p.anchor.contains(e.target))) p.onClose(); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); last.current.onClose(); back(); } }
      var t = setTimeout(function () { document.addEventListener('mousedown', close); }, 0);
      document.addEventListener('keydown', key, true);
      var first = ref.current && (ref.current.querySelector('[role^="menuitem"]:not(:disabled):not([aria-disabled="true"])') || ref.current.querySelector('[role^="menuitem"]:not(:disabled)')); if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      return function () { clearTimeout(t); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key, true); };
    }, []);
    var items = p.items || [];
    var r = p.anchor && p.anchor.getBoundingClientRect ? p.anchor.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
    var W = 240, vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    var left = Math.max(8, Math.min(p.align === 'end' ? r.right - W : r.left, vw - W - 8));
    var top = r.bottom + 6;
    /* il fuoco torna a returnFocus se è nella pagina (richiesta 217, come DetailPanel), altrimenti al pulsante che ha aperto il menu */
    function back() { var q = last.current, rf = q.returnFocus, t = rf && rf.current !== undefined ? rf.current : rf; if (!(t && t.focus && document.contains(t))) t = q.anchor; if (t && t.focus && document.contains(t)) t.focus(); }
    /* misurato (le righe del perché, richiesta 83; la testa): sotto se ci sta, altrimenti sopra se ci sta, altrimenti dal lato con più spazio, alto quanto quel lato e con lo scroll; dentro la finestra a 8 px dai bordi, anche col pulsante fuori vista o una voce lunga (richiesta 216) */
    React.useLayoutEffect(function () { var m = ref.current; if (p.inline || !m) return; var st = m.scrollTop, cs = getComputedStyle(m); m.style.maxHeight = ''; m.style.overflowY = ''; m.style.maxWidth = ''; m.style.left = '0px'; /* misurato a sinistra: la larghezza non dipende da dov'era */
      var b = m.getBoundingClientRect(); if (b.width > vw - 16) { m.style.maxWidth = Math.max(vw - 16 - (b.width - parseFloat(cs.width)), 0) + 'px'; b = m.getBoundingClientRect(); } /* il max-width del CSS non conta padding e bordo */
      var hgt = b.height, lo = Math.max(8, r.bottom + 6), hi = Math.min(vh - 8, r.top - 6), below = vh - 8 - lo, above = hi - 8;
      if (hgt <= below) m.style.top = lo + 'px';
      else if (hgt <= above) m.style.top = hi - hgt + 'px';
      else { var dn = below >= above, room = Math.max(dn ? below : above, 0); m.style.maxHeight = Math.max(room - (hgt - parseFloat(cs.height)), 0) + 'px'; m.style.overflowY = 'auto'; m.style.top = (dn ? lo : 8) + 'px'; m.scrollTop = st; }
      var bw = m.getBoundingClientRect().width; /* dopo lo scroll: la barra classica allarga il menu */
      m.style.left = Math.max(8, Math.min(p.align === 'end' ? r.right - bw : r.left, vw - bw - 8)) + 'px';
    });
    function move(e) {
      if (e.key === 'Tab') { if (p.anchor && p.anchor.focus && document.contains(p.anchor)) { e.preventDefault(); if (p.onClose) p.onClose(); p.anchor.focus(); } return; } /* richiesta 93: col pulsante che l'ha aperto il fuoco torna lì; senza, il Tab resta del browser o di chi contiene il menu (un Dialog) */
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return; /* Home e Fine: la prima e l'ultima voce (richiesta 132) */
      e.preventDefault();
      var list = Array.prototype.slice.call(ref.current.querySelectorAll('[role^="menuitem"]:not(:disabled)'));
      var i = list.indexOf(document.activeElement);
      var n = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]; if (n) n.focus();
    }
    return h('div', { ref: ref, className: cx('zr-menu', p.className), role: 'menu', 'aria-label': p.label, style: p.inline ? null : { top: top, left: left }, onKeyDown: move },
      p.head ? h('div', { className: 'zr-menu-head', role: 'presentation' }, p.head) : null,
      items.map(function (it, i) {
        if (it.sep) return h('div', { key: 'sep' + i, className: 'zr-menu-sep', role: 'separator' });
        /* spenta col perché: resta raggiungibile con le frecce e dice perché non si può, a vista e al lettore (richiesta 83) */
        var why = it.disabled && it.reason, wid = why ? mid + '-r' + i : undefined;
        var pick = typeof it.checked === 'boolean'; /* una scelta fra più (la pipeline, la vista): menuitemradio con aria-checked e il segno (richiesta 1) */
        var item = h('button', { key: i, type: 'button', role: pick ? 'menuitemradio' : 'menuitem', 'aria-checked': pick ? it.checked : undefined, className: cx('zr-menu-item', it.danger && 'is-danger', why && 'is-disabled'), disabled: it.disabled && !why, 'aria-disabled': why ? true : undefined, 'aria-describedby': wid,
          onClick: function () { if (why) return; p.onClose && p.onClose(); back(); if (it.onClick) it.onClick(); } },
          it.icon ? h(Icon, { name: it.icon, size: 16 }) : pick ? (it.checked ? h(Icon, { name: 'check', size: 16 }) : h('span', { className: 'zr-menu-check', 'aria-hidden': true })) : null, h('span', { className: 'zr-menu-label' }, it.label), it.hint ? h('kbd', { className: 'zr-kbd' }, it.hint) : null);
        return why ? [item, h('p', { key: 'r' + i, id: wid, className: 'zr-menu-reason', 'aria-hidden': true }, it.reason)] : item;
      }));
  }

  /* ---------- Composer (P-15: creazione in linea) ---------- */
  function Composer(p) {
    var id = useId('cmp'), C = useLabels();
    var st = useState(p.defaultValue || ''), v = st[0], set = st[1];
    var bs = useState(false), busy = bs[0];
    /* il testo resta finché la creazione non riesce: onCreate che torna false, o una Promise rifiutata o risolta a false, lo lascia nel campo (richiesta 156) */
    function submit() {
      var t = v.trim(); if (!t) { if (p.onCancel) p.onCancel(); return; }
      if (busy) return;
      var r = p.onCreate ? p.onCreate(t) : undefined; /* riuscita, si svuota solo se nel frattempo non si è scritto altro */
      if (r === false) return;
      if (r && typeof r.then === 'function') { bs[1](true); r.then(function (ok) { bs[1](false); if (ok !== false) set(function (cur) { return cur.trim() === t ? '' : cur; }); }, function () { bs[1](false); }); return; }
      set('');
    }
    var eid = p.error ? id + '-e' : undefined;
    return h('div', { className: cx('zr-composer', p.error && 'is-error', p.className) },
      h('textarea', { autoFocus: p.autoFocus !== false, rows: p.rows || (p.multiline ? 2 : 1), value: v, placeholder: p.placeholder, maxLength: p.maxLength, 'aria-label': p.label || p.placeholder, 'aria-invalid': p.error ? true : undefined, 'aria-describedby': eid,
        onChange: function (e) { set(p.multiline ? e.target.value : e.target.value.replace(/\n/g, '')); },
        onKeyDown: function (e) { if (e.key === 'Enter' && !(p.multiline && e.shiftKey)) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); set(''); if (p.onCancel) p.onCancel(); } } }),
      p.error ? h('p', { id: eid, className: 'zr-field-msg is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 14 }), p.error) : null,
      h('div', { className: 'zr-composer-row' },
        h(Button, { size: 'sm', busy: busy, onClick: submit }, p.submitLabel || C.add),
        h(Button, { size: 'sm', variant: 'ghost', icon: 'close', 'aria-label': p.closeLabel || C.cancel, onClick: function () { set(''); if (p.onCancel) p.onCancel(); } })));
  }

  /* ---------- DetailPanel (P-15: dettaglio nel pannello a destra) ---------- */
  var PANEL_FULL = '(max-width: 720px)'; /* la stessa misura di bundle.css: sotto, il pannello copre la pagina */
  var FOCUSABLE = ['a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]'].map(function (s) { return s + ':not([tabindex="-1"])'; }).join(', ');
  function DetailPanel(p) {
    var ref = useRef(null), last = useRef(p), C = useLabels(); last.current = p;
    var mqRef = useRef(undefined); if (mqRef.current === undefined) mqRef.current = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PANEL_FULL) : null;
    var mq = mqRef.current;
    var fullSt = useState(mq ? mq.matches : false), full = fullSt[0], setFull = fullSt[1];
    React.useEffect(function () {
      if (!mq) return;
      function ch() { setFull(mq.matches); }
      if (mq.addEventListener) mq.addEventListener('change', ch); else mq.addListener(ch);
      return function () { if (mq.removeEventListener) mq.removeEventListener('change', ch); else mq.removeListener(ch); };
    }, []);
    /* modale: con modal={true}, o da solo quando copre la pagina (sotto 720 px, non inline) */
    var modal = p.modal !== undefined ? !!p.modal : (!p.inline && full);
    React.useEffect(function () {
      var origin = document.activeElement;
      var t = ref.current && (ref.current.querySelector('[data-autofocus]') || ref.current);
      if (t && t.focus) try { t.focus({ preventScroll: true }); } catch (e) {}
      function key(e) {
        /* un Esc già usato da altro, o con sopra un dialogo o un menu, non chiude il pannello */
        if (e.key !== 'Escape' || e.defaultPrevented || !last.current.onClose) return;
        if (document.querySelector('.zr-scrim, .zr-menu, dialog[open], [role="menu"]')) return;
        last.current.onClose();
      }
      document.addEventListener('keydown', key);
      return function () {
        document.removeEventListener('keydown', key);
        var rf = last.current.returnFocus, target = rf && rf.current !== undefined ? rf.current : rf;
        var id = origin && origin.getAttribute && origin.getAttribute('data-id');
        var back = target && document.contains(target) ? target : id ? document.querySelector('[data-id="' + id + '"]') : origin;
        if (back && document.contains(back) && back.focus && !document.querySelector('.zr-detail')) try { back.focus({ preventScroll: true }); } catch (e) {}
      };
    }, []);
    /* il Tab resta dentro quando il pannello è modale */
    function trap(e) {
      if (!modal || e.key !== 'Tab' || e.defaultPrevented || !ref.current || document.querySelector('.zr-scrim, dialog[open]')) return; /* un dialogo aperto sopra tiene lui il Tab */
      var els = Array.prototype.filter.call(ref.current.querySelectorAll(FOCUSABLE), function (el) { return el.getClientRects().length > 0; });
      if (!els.length) { e.preventDefault(); ref.current.focus(); return; }
      var first = els[0], lastEl = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === ref.current)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && a === lastEl) { e.preventDefault(); first.focus(); }
    }
    var hasActs = p.actions != null && p.actions !== false && !(Array.isArray(p.actions) && !p.actions.some(Boolean));
    var closeBtn = h(Button, { variant: 'ghost', size: 'sm', icon: 'close', className: 'zr-detail-close', 'aria-label': p.closeLabel || C.close, onClick: p.onClose });
    return h('aside', { ref: ref, tabIndex: -1, className: cx('zr-detail', p.inline && 'is-inline', p.className), role: 'dialog', 'aria-modal': modal ? 'true' : 'false', 'aria-label': p.label, onKeyDown: trap },
      h('header', { className: 'zr-detail-head' },
        h(Button, { variant: 'ghost', size: 'sm', icon: 'chevronLeft', className: 'zr-detail-back', onClick: p.onBack || p.onClose }, p.backLabel || C.back),
        h('div', { className: 'zr-detail-ctx' }, p.head),
        hasActs ? h('div', { className: 'zr-detail-actions' }, p.actions) : null, /* le azioni del pannello a destra, con la chiusura (richiesta 191): la ✕ resta al suo posto, non si rimonta */
        closeBtn),
      h('div', { className: 'zr-detail-body' }, p.children),
      p.foot ? h('footer', { className: 'zr-detail-foot' }, p.foot) : null);
  }

  window.Zeiras = Object.assign(window.Zeiras || {}, {
    Logo: Logo, Button: Button, Label: Label, Avatar: Avatar, AvatarStack: AvatarStack, Icon: Icon,
    AppShell: AppShell, DashboardHome: DashboardHome, ProductTile: ProductTile, ProjectFolder: ProjectFolder,
    KanbanCard: KanbanCard, KanbanColumn: KanbanColumn, KanbanBoard: KanbanBoard, AddList: AddList, KANBAN_TEXTS: KANBAN_TEXTS,
    SiteHeader: SiteHeader, Hero: Hero, SectionHeading: SectionHeading, StepList: StepList, AudienceGrid: AudienceGrid,
    PricingCard: PricingCard, FAQ: FAQ, CtaBand: CtaBand, SiteFooter: SiteFooter, LandingPage: LandingPage, LanguageSwitch: LanguageSwitch, SectorGrid: SectorGrid, Breadcrumb: Breadcrumb,
    ICON_NAMES: ICON_NAMES, BrandIcon: BrandIcon, BRAND_ICON_NAMES: BRAND_ICON_NAMES, Field: Field, MentionField: MentionField, MENTION_LABELS: MENTION_LABELS, AddressField: AddressField, ADDRESS_LABELS: ADDRESS_LABELS, Checkbox: Checkbox, RadioGroup: RadioGroup, ColorPicker: ColorPicker, COLOR_NAMES: COLOR_NAMES, ToggleGroup: ToggleGroup, InlineEdit: InlineEdit, INLINE_EDIT_LABELS: INLINE_EDIT_LABELS, Calendar: Calendar, CALENDAR_LABELS: CALENDAR_LABELS, AgendaGrid: AgendaGrid, AGENDA_LABELS: AGENDA_LABELS, Switch: Switch, Tabs: Tabs, Alert: Alert, Toast: Toast, Dialog: Dialog, EmptyState: EmptyState, Progress: Progress, Skeleton: Skeleton, PageHeader: PageHeader,
    DataTable: DataTable, DATATABLE_LABELS: DATATABLE_LABELS, ReorderList: ReorderList, REORDER_LABELS: REORDER_LABELS, FilterBar: FilterBar, StatCard: StatCard, ChartCard: ChartCard, SectionCard: SectionCard, LineChart: LineChart, BarChart: BarChart, DonutChart: DonutChart, Sparkline: Sparkline,
    StatusLabel: StatusLabel, RecordHeader: RecordHeader, ActivityTimeline: ActivityTimeline, DescriptionList: DescriptionList, DealCard: DealCard, DealPipeline: DealPipeline, CrmContacts: CrmContacts, ContactDetail: ContactDetail,
    ReportDashboard: ReportDashboard, AutomationStep: AutomationStep, WorkflowBuilder: WorkflowBuilder, AutomationList: AutomationList, ContentStudio: ContentStudio, DetailPanel: DetailPanel, Composer: Composer, Menu: Menu, NotificationItem: NotificationItem, AppointmentItem: AppointmentItem, LabelsProvider: LabelsProvider, useLabels: useLabels, COMMON_LABELS: COMMON_LABELS, APPSHELL_LABELS: APPSHELL_LABELS, MODULES_NAV: MODULES_NAV, PUBLISHER: PUBLISHER
  });
})();
