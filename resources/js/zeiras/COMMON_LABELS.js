// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È COMMON_LABELS di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- LabelsProvider ---------- */
  /* i testi comuni dei componenti (Chiudi, Annulla, Indietro, Aggiungi, Togli) nella lingua dell'app (richiesta 186): la lingua la dà
     LabelsProvider, altrimenti <html lang> (letto a ogni disegno); una lingua che non c'è prende quella di sopra, poi <html lang>, poi l'inglese (senza nessuna lingua, l'italiano). La prop del
     componente (closeLabel, backLabel, submitLabel…) vince sempre */
  var COMMON_LABELS = {
    it: { lang: 'it', close: 'Chiudi', cancel: 'Annulla', back: 'Indietro', add: 'Aggiungi', remove: 'Togli', unread: 'non letta' },
    en: { lang: 'en', close: 'Close', cancel: 'Cancel', back: 'Back', add: 'Add', remove: 'Remove', unread: 'unread' },
    es: { lang: 'es', close: 'Cerrar', cancel: 'Cancelar', back: 'Atrás', add: 'Añadir', remove: 'Quitar', unread: 'no leída' }
  };

export { COMMON_LABELS };
