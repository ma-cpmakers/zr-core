// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 2 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

  function drawerBack(el) { return el && el.closest && el.closest('.zr-side:not(.is-open)') && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches ? (document.querySelector('.zr-shell .zr-top-menu') || el) : el; }

export { drawerBack };
