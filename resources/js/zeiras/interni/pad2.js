// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 2 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function tOfIso(iso) { var a = String(iso).split('-'); return Date.UTC(+a[0], +a[1] - 1, +(a[2] || 1)); }
  function localTodayIso() { var n = new Date(); return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate()); }

export { localTodayIso, pad2, tOfIso };
