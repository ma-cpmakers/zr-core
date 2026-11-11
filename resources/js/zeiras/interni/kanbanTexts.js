// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 6 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { KANBAN_TEXTS } from '../KANBAN_TEXTS';

  function kanbanTexts(t) { var o = Object.assign({}, KANBAN_TEXTS); if (t) Object.keys(t).forEach(function (k) { if (t[k] != null) o[k] = t[k]; }); return o; } /* un testo undefined o null resta quello di default */
  function textOf(t, k, v) { return t.replace(k, function () { return v; }); } /* il testo del modulo entra com'è, anche con «$&» */

export { kanbanTexts, textOf };
