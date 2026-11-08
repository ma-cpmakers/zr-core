// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È KANBAN_TEXTS di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- KanbanCard ---------- */
  /* i testi della board nella lingua del modulo; il default è l'italiano (richiesta 149) */
  var KANBAN_TEXTS = { overdue: 'Scaduta · {date}', checklist: 'Checklist', comments: 'Commenti', wipLimit: 'Limite WIP {n}', overLimit: 'Oltre il limite', listActions: 'Azioni lista {title}', addCard: 'Aggiungi scheda', addList: 'Aggiungi lista', newList: 'Nuova lista', cardTitle: 'Titolo della scheda…', cardTitleLabel: 'Titolo della nuova scheda', add: 'Aggiungi', cancel: 'Annulla', cardActions: 'Azioni rapide', cardKeys: 'Frecce su e giù fra le schede, a sinistra e a destra fra le liste', vote: 'Vota', unvote: 'Togli il voto', votes: '{n} voti', oneVote: '1 voto', voted: 'hai votato', crumbs: 'Percorso', board: 'Board', list: 'Lista', calendar: 'Calendario', filter: 'Filtra', share: 'Condividi',
    /* richieste 224-231: il riordino delle liste, i rifiuti, il limite che blocca, la soglia, il menu della lista */
    refused: 'Non consentito qui', refusedSay: 'Non consentito qui: {reason}', onlyTo: 'Da “{from}” la scheda può andare solo in {lists}', nowhere: 'nessuna lista',
    atLimit: '“{list}” è al limite di {n} schede · Sposta o completa una scheda prima', atLimitOne: '“{list}” è al limite di 1 scheda · Sposta o completa una scheda prima',
    full: 'Al limite', wipBlocks: 'Limite WIP {n}, blocca', countOf: '{n} schede su un limite di {limit}', countOfOne: '1 scheda su un limite di {limit}',
    rules: 'Regole della lista', belowThreshold: 'Sotto la soglia: {n} su {threshold}', cardBack: '{card} resta in “{list}”',
    moveList: 'Trascina la lista {title}', listKeys: 'Per prendere la lista premi Spazio. Poi spostala con le frecce destra e sinistra. Premi Spazio per lasciarla, Esc per rimetterla dov’era.',
    listTaken: 'Hai preso la lista {title}.', listAt: 'Lista {title} al posto {n} di {total}.', listDropped: 'Lista {title} lasciata al posto {n} di {total}.',
    listCancelled: 'Spostamento annullato: la lista {title} è tornata dov’era.', listBack: 'Non spostata: la lista {title} è tornata al posto {n} di {total}.',
    listWait: 'La lista {title} aspetta ancora la conferma dello spostamento.',
    moveLeft: 'Sposta a sinistra', moveRight: 'Sposta a destra', rename: 'Rinomina', listName: 'Nome della lista', jumpTo: 'Vai alla lista' };

export { KANBAN_TEXTS };
