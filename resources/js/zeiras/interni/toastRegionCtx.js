// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 2 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';

  /* ToastRegion: la regione aria-live che sta nella pagina prima dei Toast; un Toast che ci entra si annuncia anche coi lettori di schermo
     che leggono solo ciò che cambia in una regione che c'era già, e non ha più role="status" suo, per non essere detto due volte (richiesta 269) */
  var toastRegionCtx = null;
  function toastRegionContext() { if (!toastRegionCtx) toastRegionCtx = React.createContext(false); return toastRegionCtx; }

export { toastRegionContext };
