// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È CALENDAR_LABELS di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- Calendar: scegliere un giorno, il mese con gli eventi, la settimana al telefono (richiesta 140) ---------- */
  var CALENDAR_LABELS = { prevMonth: 'Mese precedente', nextMonth: 'Mese successivo', prevWeek: 'Settimana precedente', nextWeek: 'Settimana successiva', marked: 'disponibile',
    events: function (n) { return n === 1 ? '1 evento' : n + ' eventi'; }, more: function (n) { return '+' + n + ' altri'; } };

export { CALENDAR_LABELS };
