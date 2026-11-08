// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 40 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './h';

  /* il numero accanto a un nome: si vede da solo, il lettore di schermo lo sente staccato e col suo nome (richieste 12, 70, 35) */
  function countParts(n, cls, label) { return [h('span', { key: 'cs', className: 'zr-visually-hidden' }, ', ' + (label || n)), h('span', { key: 'cn', className: cls, 'aria-hidden': true }, n)]; }

export { countParts };
