// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AgendaGrid di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { cx } from './interni/cx';
import { TONES } from './interni/TONES';
import { useId } from './AppShell';
import { localTodayIso, pad2, tOfIso } from './interni/pad2';
import { AGENDA_LABELS } from './AGENDA_LABELS';
import { useCompLabels } from './interni/useCompLabels';

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

export { AgendaGrid };
