// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 11 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { useLabels } from '../useLabels';

  /* i testi propri di un componente (InlineEdit, DataTable, AgendaGrid) nella stessa lingua dei testi comuni; la prop labels vince sempre (richiesta 205) */
  function useCompLabels(texts, own) { var C = useLabels(); return Object.assign({}, texts[C.lang] || texts.it, own || {}); }

export { useCompLabels };
