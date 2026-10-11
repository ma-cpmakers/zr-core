import dati from '../registro/prodotti.json';
import type { IconName, Tone } from '../zeiras/index';

// Il registro dei prodotti di zr-core (resources/registro/prodotti.json): le voci del menu Prodotti nell'ordine della linea guida
// 10 del design system, Dashboard per prima. Come si mostra un prodotto lo dice questo registro, e il suo nome le lingue; il
// backoffice dice solo quali prodotti sono attivi in un workspace.

/** Gli id dei prodotti, Dashboard esclusa: ognuno ha il suo nome in ogni lingua, con l'id per chiave. Un prodotto nuovo entra anche qui. */
export type IdDiProdotto = 'pm' | 'crm' | 'bookings' | 'reports' | 'automations' | 'content';

/** Le risorse dei prodotti che la ricerca mostra, `<prodotto>.<tipo>`: ognuna ha il nome del suo gruppo in ogni lingua, con questa chiave. Una risorsa nuova entra anche qui. */
export type TipoDiRisorsa = 'pm.board.cartelle' | 'pm.board.board';

/** Un tipo di risorsa di un prodotto, come la ricerca del backoffice lo dà: come si mostra e dove si apre. */
export interface RisorsaDelProdotto {
    /**
     * Il tipo nel backoffice: il `tipo` di un risultato della ricerca (`board.board`, `board.cartelle`). Sta in un prodotto
     * solo: un risultato non dice di che prodotto è, e la cornice lo trova da qui.
     */
    tipo: string;
    icona: IconName;
    /**
     * Il percorso nel prodotto, dopo `/w/<slug>`: `{id}` è l'id della risorsa. Vuoto se la risorsa non ha una pagina sua
     * (una cartella): si apre sulla pagina del prodotto nel workspace.
     */
    percorso: string;
    /** Un contenitore (cartella, board) si apre a pagina intera, un elemento nel pannello del prodotto. */
    contenitore: boolean;
}

/** Una notifica di un prodotto che dal pannello della cornice apre la sua risorsa: il tipo dell'evento, e dove si apre. */
export interface NotificaDelProdotto {
    /**
     * Il tipo intero dell'evento che l'ha generata (`com.zeiras.crm.persona.creata`), com'è nel backoffice. Sta una volta sola in
     * tutto il registro, nella voce dell'app da cui la notifica viene, e ha il suo titolo in ogni lingua.
     */
    tipo: string;
    /**
     * Il percorso nel prodotto, dopo `/w/<slug>`. Un segnaposto è `{id}` o `{<nome>_id}`, e prende l'id che la notifica porta con
     * quella chiave (`ids`): `{persona_id}` per una nota, che si apre nel contatto a cui è attaccata. Senza uno dei suoi id la
     * notifica non ha una destinazione.
     */
    percorso: string;
}

/** Una voce del menu Prodotti. Il nome sta nelle lingue: il testo `dashboard` per la Dashboard, il testo col suo id per un prodotto. */
export interface VoceDelRegistro {
    /** L'id del design system (`active` e `product` dell'`AppShell`); `home` è la Dashboard. */
    id: 'home' | IdDiProdotto;
    icona: IconName;
    /** Il tono del prodotto; la Dashboard non ce l'ha. */
    tono?: Exclude<Tone, 'neutral'>;
    /** L'indirizzo del prodotto, senza workspace: la cornice ci aggiunge `/w/<slug>`. */
    indirizzo: string;
    /** «Presto»: il prodotto non è ancora disponibile, e la sua voce non porta da nessuna parte, in nessun workspace. È della cornice. */
    presto: boolean;
    /**
     * In arrivo per chi non ha una sessione: nessuno può ancora aprire il prodotto, salvo i workspace che il backoffice ammette
     * in anteprima. Lo leggono le pagine senza un workspace a cui chiedere lo stato (Registrati); la cornice no: dentro la
     * sessione lo stato lo dà il backoffice. Ogni prodotto «Presto» è anche in arrivo.
     */
    in_arrivo: boolean;
    /** Le risorse del prodotto che la ricerca mostra: un risultato di un tipo che non è qui non si mostra. */
    risorse?: RisorsaDelProdotto[];
    /**
     * Le notifiche del prodotto che dal pannello aprono la loro risorsa (`destinazioneDellaNotifica`): una notifica di un tipo che
     * non è qui apre la pagina delle notifiche.
     */
    notifiche?: NotificaDelProdotto[];
}

export const registro: readonly VoceDelRegistro[] = dati.prodotti as VoceDelRegistro[];

/** Il prodotto del registro con quel codice; la Dashboard non è un prodotto. */
export function prodottoDelRegistro(codice: string | null | undefined): VoceDelRegistro | undefined {
    return registro.find((voce) => voce.id === codice && voce.id !== 'home');
}

/** L'indirizzo di un prodotto in un workspace: è così che workspace e permessi passano da un prodotto all'altro. */
export function nelWorkspace(indirizzo: string, slug: string): string {
    return `${indirizzo}/w/${encodeURIComponent(slug)}`;
}

/** Porta al prodotto solo uno stato che zr-core conosce: `attivo` o `disponibile`. Ogni altro, anche nuovo, è «Presto». */
export function raggiungibile(stato: string | undefined): boolean {
    return stato === 'attivo' || stato === 'disponibile';
}
