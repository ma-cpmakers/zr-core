import dati from '../registro/prodotti.json';
import type { IconName, Tone } from '../zeiras/index';

// Il registro dei prodotti di zr-core (resources/registro/prodotti.json): le voci del menu Moduli nell'ordine della linea guida
// 10 del design system, Dashboard per prima. Come si mostra un prodotto lo dice questo registro, e il suo nome le lingue; il
// backoffice dice solo quali prodotti sono attivi in un workspace.

/** Gli id dei prodotti, Dashboard esclusa: ognuno ha il suo nome in ogni lingua, con l'id per chiave. Un prodotto nuovo entra anche qui. */
export type IdDiProdotto = 'pm' | 'crm' | 'bookings' | 'flow' | 'reports' | 'automations' | 'content';

/**
 * Le risorse del registro che la ricerca mostra, `<voce>.<tipo>`: ognuna ha in ogni lingua il nome del suo gruppo, con questa
 * chiave, e il suo nome da elenco, minuscolo, con `searchSource.` davanti (quello che l'invito della ricerca nomina). Sono
 * dei prodotti, tranne il membro del workspace, la cui pagina è di app: sta nella voce `home`. Una risorsa nuova entra anche
 * qui.
 */
export type TipoDiRisorsa = 'home.workspace.membro' | 'pm.board.scheda' | 'pm.board.board' | 'pm.board.cartelle' | 'crm.crm.persona' | 'crm.crm.organizzazione' | 'crm.crm.trattativa';

/**
 * I codici che il registro dà a una chiave di `contesto` di una risorsa, `<voce>.<tipo>.<chiave>.<codice>` (`codici`): ognuno
 * ha il suo testo in ogni lingua, con `searchContext.` davanti. Un codice nuovo entra anche qui. Dell'esito di un'opportunità
 * i codici sono due: `aperta`, che il backoffice dà per un'opportunità aperta, non è un codice e non ha un testo.
 */
export type CodiceDelContesto = 'home.workspace.membro.ruolo.proprietario' | 'home.workspace.membro.ruolo.amministratore' | 'home.workspace.membro.ruolo.membro' | 'crm.crm.trattativa.esito.vinta' | 'crm.crm.trattativa.esito.persa';

/** Un tipo di risorsa di una voce del registro, come la ricerca del backoffice lo dà: come si mostra e dove si apre. */
export interface RisorsaDelProdotto {
    /**
     * Il tipo nel backoffice: il `tipo` di un risultato della ricerca (`board.scheda`, `crm.persona`, `workspace.membro`). Sta
     * in una voce sola: un risultato non dice di che prodotto è, e la cornice lo trova da qui.
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
    /**
     * Le chiavi di `contesto` — i testi che il backoffice dà con un risultato per riconoscerlo — che fanno la sua seconda riga,
     * nell'ordine in cui si leggono: `board` e `lista` di una scheda. Senza, il tipo non ha una seconda riga. Sono anche le
     * sole chiavi che la parte server lascia uscire da `POST /cornice/ricerca`: chi ne aggiunge una qui per la seconda riga
     * apre anche quell'uscita.
     */
    contesto?: string[];
    /**
     * I codici che una chiave di `contesto` può portare, dove il backoffice dà un codice e non un testo da mostrare: il `ruolo`
     * di un membro del workspace (`proprietario`, `amministratore`, `membro`), l'`esito` di un'opportunità chiusa (`vinta`,
     * `persa`). Il testo di ogni codice sta nelle lingue (`CodiceDelContesto`). Un valore che non è fra i codici non si mostra:
     * è così che un'opportunità aperta (`aperta`) non mostra l'esito. Una chiave senza codici porta un testo, come il `ruolo` di
     * un contatto del CRM («Direttore»).
     */
    codici?: Record<string, string[]>;
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
     * quella chiave (`ids`): `{trattativa_id}` per una nota, che si apre nell'opportunità a cui è attaccata. Un percorso può non
     * avere un segnaposto (`/da-fare`, per un'attività, che non ha una pagina sua): allora non chiede un id. Senza uno dei suoi
     * id questo percorso non si apre, e si provano quelli di `altrimenti`.
     */
    percorso: string;
    /**
     * Gli altri percorsi, quando la risorsa può stare in più posti, dal più specifico: si provano in ordine dopo `percorso`, e
     * si apre il primo che ha tutti i suoi id — per una nota il contatto, poi l'azienda. Senza questa chiave il percorso è uno
     * solo; se nessuno ha i suoi id la notifica non ha una destinazione.
     */
    altrimenti?: string[];
}

/** Una voce del menu Moduli. Il nome sta nelle lingue: il testo `dashboard` per la Dashboard, il testo col suo id per un prodotto. */
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
    /**
     * Le risorse della voce che la ricerca mostra: un risultato di un tipo che non è qui non si mostra. Quelle di `home` non sono
     * di un modulo: il membro del workspace, che si apre in app.
     */
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

/**
 * Le fonti della ricerca in un workspace: i tipi di risorsa dei prodotti che lì sono `attivo`, nell'ordine del registro, e dopo
 * quelli della voce della Dashboard (il membro del workspace). Il backoffice cerca solo nelle app attive nel workspace: un
 * prodotto `disponibile` o in arrivo non dà fonti. I membri non sono di un'app: li cerca in ogni workspace, e sono una fonte
 * anche dove nessun prodotto è attivo. Vengono per ultimi, benché la loro voce sia la prima del registro: l'invito della
 * ricerca nomina le fonti in quest'ordine, prima quelle dei prodotti attivi e in fondo i membri. `prodotti` è lo stato di
 * ogni prodotto nel workspace, come nei dati della cornice.
 */
export function fontiDellaRicerca(prodotti: Partial<Record<IdDiProdotto, string | undefined>>): TipoDiRisorsa[] {
    const tipiDi = (voce: VoceDelRegistro) => (voce.risorse ?? []).map((risorsa) => `${voce.id}.${risorsa.tipo}` as TipoDiRisorsa);

    return [
        ...registro.flatMap((voce) => (voce.id !== 'home' && prodotti[voce.id] === 'attivo' ? tipiDi(voce) : [])),
        ...registro.flatMap((voce) => (voce.id === 'home' ? tipiDi(voce) : [])),
    ];
}

/** Porta al prodotto solo uno stato che zr-core conosce: `attivo` o `disponibile`. Ogni altro, anche nuovo, è «Presto». */
export function raggiungibile(stato: string | undefined): boolean {
    return stato === 'attivo' || stato === 'disponibile';
}
