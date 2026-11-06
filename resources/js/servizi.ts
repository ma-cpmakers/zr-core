// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

import { pezzoARichiesta } from './lingue';

// Il trasporto delle chiamate (chi chiede, il gettone CSRF, gli errori) sta in `./chiamate` dalla `v4.20.0`: lo usano anche le
// due chiamate che segnano lette, nel pezzo della campanella, che così non porta con sé il caricatore della ricerca.
export { AccettazioneRichiesta, aSchermo, chiama, haLaFormaDiUnId, mostra, segno, TroppeRichieste, type Persona } from './chiamate';
import { chiama, segno, type Persona } from './chiamate';

/** Una notifica come la dà GET /cornice/notifiche. Chi ha fatto, su che cosa e per chi ci sono quando il backoffice li manda. */
export interface NotificaDellaCornice {
    id: string;
    /** Un istante RFC 3339, con l'ora e il fuso: quello dell'ultima azione che la notifica racconta (quando è nata, se è una sola). */
    creata_il: string;
    letta: boolean;
    /** Il codice dell'app da cui viene (`pm`, `crm`…), com'è nel backoffice: `null` se non è di un'app. Di che prodotto è, e come si mostra, lo dice il registro. */
    app: string | null;
    /** Il tipo dell'evento che l'ha generata (`com.zeiras.board.scheda.creata`…), com'è nel backoffice: che titolo ha lo dicono le lingue. La parte server lo dà sempre; senza, il titolo è quello di ripiego. */
    tipo?: string;
    /** Il nome di chi ha fatto ciò che la notifica racconta: `null` se non c'è una persona, o se il backoffice non lo dice. */
    autore_nome?: string | null;
    /** Il nome della cosa a cui la notifica si riferisce (una board, una scheda…), com'è nel backoffice: `null` se non ha un nome, o se il backoffice non lo dice. Per una notifica su un'app (un tipo `com.zeiras.app.…`) è il codice dell'app, e non si mostra: il testo da mostrare lo dà `risorsaDellaNotifica`. */
    risorsa_nome?: string | null;
    /** `true` se è rivolta alla persona, `false` se è per tutto il workspace, `null` se il backoffice non lo sa: `null` non è `false`. */
    per_me?: boolean | null;
    /** Quante azioni la notifica racconta: un intero da 1 in su. Una parte server di prima della `v2.1.0` non lo dà, ed è una sola. */
    azioni?: number;
    /** Il nome della board in cui sta la cosa (una scheda, una lista…), com'è nel backoffice: `null` se la cosa non sta in una board, o se il backoffice non lo dice. */
    board_nome?: string | null;
    /**
     * Gli id che servono ad aprire la risorsa della notifica (`destinazioneDellaNotifica`), per chiave (`id`, `persona_id`…): dei
     * `dati` dell'evento la parte server dà solo quelli del percorso che si apre — il primo del suo tipo, nel registro, che
     * `dati` soddisfa per intero —, e solo con la forma di un id. Vuoto per un tipo che nel registro non ha una destinazione, e
     * anche quando il percorso non chiede un id (un'attività, che apre «Da fare»). Una parte server di prima della `v1.11.0` non
     * li dà, e allora la notifica apre la pagina delle notifiche.
     */
    ids?: Record<string, string>;
    /**
     * Quando accade la cosa che la notifica racconta (dalla `v3.6.0`: l'inizio di una prenotazione, il giorno di una scadenza):
     * l'istante e il fuso in cui si legge. `null` quando il backoffice non lo dà, o non nella forma concordata.
     */
    quando?: QuandoDellaCornice | null;
    /**
     * Com'è stata decisa la cosa che la notifica racconta (dalla `v4.16.0`: l'esito di un Gate, `approvato`, `con_prescrizioni`,
     * `respinto`): un testo di lettere minuscole e `_`, o `null` quando il backoffice non lo dà, o non in quella forma.
     */
    esito?: string | null;
}

/** Un istante come lo danno le rotte della cornice (dalla `v3.6.0`): `il` in UTC, con la `Z`; `fuso`, il nome IANA in cui si legge (`Europe/Rome`). */
export interface QuandoDellaCornice {
    il: string;
    fuso: string;
}

/** Un risultato della ricerca come lo dà POST /cornice/ricerca: il contratto non dice di che prodotto è. */
export interface RisultatoDellaRicerca {
    /** Il tipo della risorsa nel backoffice (`board.scheda`, `crm.persona`): di che prodotto è, e come si mostra, lo dice il registro. */
    tipo: string;
    id: string;
    titolo: string;
    /**
     * I testi che il backoffice dà per riconoscerla (dalla `v1.15.0`): `board` e `lista` di una scheda, `organizzazione` e
     * `ruolo` di un contatto, `pipeline` e `fase` di un'opportunità; dalla `v1.17.0` anche il `ruolo` di un membro del workspace,
     * che è un codice (`proprietario`, `amministratore`, `membro`) e non un testo da mostrare: la cornice mostra quello che il
     * codice ha nella lingua. Dalla `v1.18.0` anche l'`esito` di un'opportunità, un codice anche lui: `vinta` e `persa` la
     * cornice li mostra nella lingua, `aperta` arriva e non si mostra. Dalla rotta arrivano le sole chiavi che il registro dà al
     * tipo (`risorse[].contesto`), coi soli testi non vuoti: mai un `null` fra i valori, e `null` tutto il contesto quando non
     * ne resta nessuno — sempre per un'azienda, una board e una cartella. Sono le stesse chiavi che fanno la seconda riga del
     * risultato. Il tipo ammette ancora un `null` fra i valori, e che `contesto` manchi: una parte server finta di prima della
     * `v1.15.0` non lo dà, e vale come `null`. Dalla `v3.6.0` un valore solo può non essere un testo: `quando` (la data di una
     * prenotazione), nella forma di `QuandoDellaCornice`.
     */
    contesto?: Record<string, string | QuandoDellaCornice | null> | null | undefined;
}

/**
 * Le notifiche del workspace, dalla più recente: GET /cornice/notifiche. `il` è l'istante in cui la parte server ha cominciato
 * a leggerle (`aggiornati_il`). Una risposta senza l'istante, o con un istante in un'altra forma, non è un errore: è senza segno.
 * `workspace` è lo slug del workspace di cui sono, come lo dice la parte server (dalla `v1.12.0`): quello della sessione, che
 * non è sempre quello della pagina. Se la risposta non lo dice, o non lo dice con un testo, non è un errore: non si sa.
 * `persona` è quella della cornice che chiede (email e impronta): un elenco, o un errore, di un'altra persona non torna (`chiama`).
 */
export async function caricaNotifiche(persona: Persona): Promise<{ elenco: NotificaDellaCornice[]; il: string | undefined; workspace: string | undefined }> {
    const corpo = (await chiama('/cornice/notifiche', persona)) as { data?: unknown; aggiornati_il?: unknown; workspace?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error('GET /cornice/notifiche: data');
    }

    return { elenco: corpo.data as NotificaDellaCornice[], il: segno(corpo.aggiornati_il), workspace: typeof corpo.workspace === 'string' ? corpo.workspace : undefined };
}

/** Il pezzo a richiesta con la ricerca della cornice (`./ricerca`, dalla `v2.8.0`): niente finché non è arrivato. */
export let ricerca: typeof import('./ricerca') | undefined;

const ilPezzoDellaRicerca = pezzoARichiesta<typeof import('./ricerca')>(() => import('./ricerca'), (daLi) => import(/* @vite-ignore */ daLi), import.meta.url);

/**
 * Chiede il pezzo della ricerca, e quando è arrivato lo tiene (`ricerca`). La cornice lo chiede al primo fuoco nel campo della
 * ricerca, o alla prima parola, mai al montaggio. Se non arriva la promessa è respinta e niente resta: la richiesta dopo lo
 * richiede, come per la campanella (`pezzoARichiesta`, in `lingue.ts`), passata l'attesa che dalla `v2.11.5` segue un pezzo
 * non arrivato; nell'attesa è respinta subito, senza richiederlo. Arrivato, non si chiede più. Sta qui e non in `lingue.ts`, che è anche di chi prende solo le frasi (`resources/js/frasi`):
 * lì un pezzo della ricerca non serve.
 */
export const chiediLaRicerca = async () => (ricerca ??= await ilPezzoDellaRicerca());
