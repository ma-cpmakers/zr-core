// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AppShell di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// Qui stanno anche useId, che altri moduli importano da qui: AppShell
// dà un valore a un nome delle loro righe, e in un modulo ES un nome importato non si assegna.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { countParts } from './interni/countParts';
import { Icon } from './Icon';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { DEFAULT_NAV, IS_MAC, scrollStop, useOutside } from './interni/DEFAULT_NAV';
import { APPSHELL_LABELS } from './APPSHELL_LABELS';
import { Logo } from './Logo';
import { NotificationItem } from './NotificationItem';
import { useEffect } from './interni/useEffect';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { Menu } from './Menu';

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
    /* il menu «+» se ne va con le sue voci: create vuoto lo chiude, e non torna da solo quando le voci tornano (richiesta 28) */
    var hasCreate = !!(p.create && p.create.length);
    useEffect(function () { if (!hasCreate) setCreateAt(null); }, [hasCreate]);

    /* un Esc già gestito da altri, o dato con un <dialog> del browser aperto sopra, non chiude anche il cassetto (richiesta 136) */
    useEffect(function () { if (!drawer) return; function k(e) { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.zr-scrim, dialog:modal') && !pop) setDrawer(false); } document.addEventListener('keydown', k); return function () { document.removeEventListener('keydown', k); }; }, [drawer, pop]);
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
        h('div', { className: cx('zr-brand', 'zr-brand-v2', hasCreate && 'has-create') },
          h('div', { className: 'zr-brand-row' },
            h(Logo, { size: 24 }),
            hasCreate ? h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', className: 'zr-create', 'aria-label': p.createLabel || L.create, 'aria-haspopup': 'menu', 'aria-expanded': createAt ? 'true' : 'false',
              onClick: function (e) { setCreateAt(createAt ? null : e.currentTarget); } }) : null),
          wsSwitch),
        createAt && hasCreate ? h(Menu, { anchor: createAt, items: p.create, label: p.createLabel || L.create, onClose: function () { setCreateAt(null); } }) : null,
        switcher,
        h('nav', { ref: navRef, className: cx('zr-nav', behind && 'is-dimmed'), 'aria-label': L.sideNav, 'aria-hidden': behind ? 'true' : undefined }, /* il nome del nav della barra, accanto al «Percorso» (richiesta 223) */
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
  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }

export { AppShell, useId };
