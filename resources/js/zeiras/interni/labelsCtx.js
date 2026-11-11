// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 45 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { COMMON_LABELS } from '../COMMON_LABELS';

  var labelsCtx = null; /* creato al primo uso: nessuna chiamata a React mentre il bundle si carica */
  function labelsContext() { return labelsCtx || (labelsCtx = React.createContext(null)); }
  function labelsLang(l) { var k = String(l || '').toLowerCase().split('-')[0]; return Object.prototype.hasOwnProperty.call(COMMON_LABELS, k) ? k : null; }
  function pageLabels(dichiarata) { var l = typeof document !== 'undefined' && document.documentElement.lang; return COMMON_LABELS[labelsLang(l)] || (l || dichiarata ? COMMON_LABELS.en : COMMON_LABELS.it); } /* una lingua dichiarata che non c'è cade sull'inglese, come la cornice; nessuna lingua: l'italiano di sempre */

export { labelsContext, labelsLang, pageLabels };
