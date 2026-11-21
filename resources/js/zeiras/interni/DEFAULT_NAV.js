// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 41 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { MODULES_NAV } from '../MODULES_NAV';
import { useEffect } from './useEffect';

  var DEFAULT_NAV = [MODULES_NAV];
  var IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  function useOutside(open, refs, onClose) {
    useEffect(function () {
      if (!open) return;
      function down(e) { for (var i = 0; i < refs.length; i++) { if (refs[i].current && refs[i].current.contains(e.target)) return; } onClose(); }
      var t = setTimeout(function () { document.addEventListener('mousedown', down); document.addEventListener('touchstart', down); }, 0);
      return function () { clearTimeout(t); document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); };
    }, [open]);
  }

export { DEFAULT_NAV, IS_MAC, useOutside };
