// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 41 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

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

export { initials, toneFor };
