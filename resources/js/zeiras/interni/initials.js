// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 44 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- Avatar ---------- */
  /* la prima lettera coi suoi segni di ogni parola che ne ha: un'emoji o un simbolo si saltano, un accento scomposto (NFD) resta; «?» se il nome non ha lettere (richiesta 267) */
  function initials(name) {
    var parts = String(name || '').normalize('NFC').trim().split(/\s+/).map(function (w) { var m = w.match(/\p{L}\p{M}*/u); return m ? m[0] : ''; }).filter(Boolean);
    return parts.length ? (parts[0] + (parts.length > 1 ? parts[parts.length - 1] : '')).toUpperCase().normalize('NFC') : '?';
  }
  function toneFor(name) {
    var s = String(name || ''), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 997;
    return ['pine', 'citrus', 'sky', 'plum', 'coral'][n % 5];
  }

export { initials, toneFor };
