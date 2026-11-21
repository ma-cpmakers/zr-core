// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 41 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { MODULES_NAV } from '../MODULES_NAV';
import { useEffect } from './useEffect';

  /* il fuoco che tornerebbe a un elemento del cassetto chiuso o che si sta chiudendo (sotto i 1024 px) va ad «Apri il menu» (richiesta 283): Dialog e DetailPanel */
  /* i dialoghi e i pannelli visibili fuori dalle azioni del cassetto (richiesta 283) */
  var SIDE_DLG = '[role="dialog"], [role="alertdialog"], dialog[open], .zr-scrim, .zr-detail';
  function sideShown(side) { return Array.prototype.filter.call(document.querySelectorAll(SIDE_DLG), function (x) { return !x.contains(side) && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden'; }); }
  var DEFAULT_NAV = [MODULES_NAV];
  var TOP_NARROW = '(max-width: 720px)'; /* la stessa misura di bundle.css: sotto, la barra in alto ha il menu e la ricerca chiusa a icona */
  var IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  function useOutside(open, refs, onClose) {
    useEffect(function () {
      if (!open) return;
      function down(e) { for (var i = 0; i < refs.length; i++) { if (refs[i].current && refs[i].current.contains(e.target)) return; } onClose(); }
      var t = setTimeout(function () { document.addEventListener('mousedown', down); document.addEventListener('touchstart', down); }, 0);
      return function () { clearTimeout(t); document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); };
    }, [open]);
  }

export { DEFAULT_NAV, IS_MAC, SIDE_DLG, TOP_NARROW, sideShown, useOutside };
