// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È Calendar di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { Button } from './Button';
import { TONES } from './interni/TONES';
import { useId } from './AppShell';
import { useEffect } from './interni/useEffect';
import { CALENDAR_LABELS } from './CALENDAR_LABELS';
import { localTodayIso, pad2, tOfIso } from './interni/pad2';

  var DAY_MS = 86400000;
  function isoOfT(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function addMonths(iso, n) {
    var a = iso.split('-'), y = +a[0], m = +a[1] - 1 + n, d = +a[2];
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return isoOfT(Date.UTC(y, m, Math.min(d, last)));
  }
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

export { Calendar };
