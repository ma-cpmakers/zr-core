// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 4 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { CARD_COLORS } from '../CARD_COLORS';

  var CARD_COLOR_TEXTS = {
    it: { rose: 'Rosa', peach: 'Pesca', sand: 'Sabbia', lemon: 'Limone', lime: 'Lime', mint: 'Menta', sage: 'Salvia', aqua: 'Acqua', azure: 'Azzurro', lavender: 'Lavanda', lilac: 'Lilla', stone: 'Pietra', none: 'Nessuno', color: 'Colore' },
    en: { rose: 'Rose', peach: 'Peach', sand: 'Sand', lemon: 'Lemon', lime: 'Lime', mint: 'Mint', sage: 'Sage', aqua: 'Aqua', azure: 'Azure', lavender: 'Lavender', lilac: 'Lilac', stone: 'Stone', none: 'None', color: 'Color' },
    es: { rose: 'Rosa', peach: 'Melocotón', sand: 'Arena', lemon: 'Limón', lime: 'Lima', mint: 'Menta', sage: 'Salvia', aqua: 'Agua', azure: 'Celeste', lavender: 'Lavanda', lilac: 'Lila', stone: 'Piedra', none: 'Ninguno', color: 'Color' } };
  function cardColorOf(c) { return CARD_COLORS.indexOf(c) >= 0 ? c : null; }

export { CARD_COLOR_TEXTS, cardColorOf };
