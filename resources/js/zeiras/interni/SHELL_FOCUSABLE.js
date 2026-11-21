// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 42 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

  var SHELL_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  /* ciò che scorre entra nel giro del Tab finché dentro niente prende il fuoco; un tabindex che ha già resta (richieste 30 e 129) */
  function scrollStop(el, ifScrolls) { /* ifScrolls: la fermata solo finché il contenuto non ci sta (richiesta 129) */
    var mine = false;
    function fix() { var want = !el.querySelector(SHELL_FOCUSABLE) && (!ifScrolls || el.scrollHeight > el.clientHeight); if (!want && mine && el.ownerDocument.activeElement !== el) { el.removeAttribute('tabindex'); mine = false; } else if (want && !mine && !el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); mine = true; } }
    fix(); var mo = new MutationObserver(fix); mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'disabled', 'tabindex', 'contenteditable'] });
    el.addEventListener('blur', fix); /* la fermata non cade sotto il fuoco: si toglie quando il fuoco se ne va */
    var ro = ifScrolls && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null; if (ro) ro.observe(el);
    return function () { mo.disconnect(); el.removeEventListener('blur', fix); if (ro) ro.disconnect(); if (mine) el.removeAttribute('tabindex'); };
  }

export { scrollStop };
