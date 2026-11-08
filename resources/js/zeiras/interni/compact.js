// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 7 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { NF } from './NF';

  function compact(v) { return Math.abs(v) >= 1000 ? NF.format(Math.round(v / 100) / 10) + 'k' : NF.format(v); }

export { compact };
