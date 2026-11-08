// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 3 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { EUR } from './EUR';

  var MONEY = {};
  function fmtMoney(v, cur) { if (!cur || cur === 'EUR') return EUR.format(v); try { if (!MONEY[cur]) MONEY[cur] = new Intl.NumberFormat('it-IT', { style: 'currency', currency: cur, maximumFractionDigits: 0 }); return MONEY[cur].format(v); } catch (e) { return EUR.format(v); } }
  function dealMoney(p) { if (p.formatAmount) try { return p.formatAmount(p.amount); } catch (e) {} return fmtMoney(p.amount, p.currency); }

export { dealMoney, fmtMoney };
