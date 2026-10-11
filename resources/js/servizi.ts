// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

/** Una notifica come la dà GET /cornice/notifiche. Chi ha fatto, su che cosa e per chi ci sono quando il backoffice li manda. */
export interface NotificaDellaCornice {
    id: string;
    /** Un istante RFC 3339, con l'ora e il fuso. */
    creata_il: string;
    letta: boolean;
    /** Il codice dell'app da cui viene (`pm`, `crm`…), com'è nel backoffice: `null` se non è di un'app. Di che prodotto è, e come si mostra, lo dice il registro. */
    app: string | null;
    /** Il tipo dell'evento che l'ha generata (`com.zeiras.board.scheda.creata`…), com'è nel backoffice: che titolo ha lo dicono le lingue. La parte server lo dà sempre; senza, il titolo è quello di ripiego. */
    tipo?: string;
    /** Il nome di chi ha fatto ciò che la notifica racconta: `null` se non c'è una persona, o se il backoffice non lo dice. */
    autore_nome?: string | null;
    /** Il nome della cosa a cui la notifica si riferisce (una board, una scheda…): `null` se non ha un nome, o se il backoffice non lo dice. */
    risorsa_nome?: string | null;
    /** `true` se è rivolta alla persona, `false` se è per tutto il workspace, `null` se il backoffice non lo sa: `null` non è `false`. */
    per_me?: boolean | null;
}

/** Un risultato della ricerca come lo dà POST /cornice/ricerca: il contratto non dice di che prodotto è. */
export interface RisultatoDellaRicerca {
    /** Il tipo della risorsa nel backoffice (`board.board`, `board.cartelle`): di che prodotto è, e come si mostra, lo dice il registro. */
    tipo: string;
    id: string;
    titolo: string;
}

async function chiama(indirizzo: string, opzioni: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}): Promise<unknown> {
    const risposta = await fetch(indirizzo, { ...opzioni, headers: { Accept: 'application/json', ...opzioni.headers } });
    if (!risposta.ok) {
        throw new Error(`${opzioni.method ?? 'GET'} ${indirizzo}: ${risposta.status}`);
    }

    return risposta.json();
}

/**
 * Un istante della parte server, se ha la forma del suo segno: in UTC, coi microsecondi a sei cifre e `Z` in fondo
 * (`2026-10-09T21:31:05.123456Z`). Solo in quella forma due istanti si confrontano come testi, fino al microsecondo: ogni altro
 * valore è «senza segno».
 */
export function segno(valore: unknown): string | undefined {
    return typeof valore === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(valore) ? valore : undefined;
}

/**
 * Le notifiche del workspace, dalla più recente: GET /cornice/notifiche. `il` è l'istante in cui la parte server ha cominciato
 * a leggerle (`aggiornati_il`). Una risposta senza l'istante, o con un istante in un'altra forma, non è un errore: è senza segno.
 */
export async function caricaNotifiche(): Promise<{ elenco: NotificaDellaCornice[]; il: string | undefined }> {
    const corpo = (await chiama('/cornice/notifiche')) as { data?: unknown; aggiornati_il?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error('GET /cornice/notifiche: data');
    }

    return { elenco: corpo.data as NotificaDellaCornice[], il: segno(corpo.aggiornati_il) };
}

/**
 * Segna lette, con una richiesta sola, le notifiche della persona nate fino a `finoA` compreso, anche quelle che la cornice non
 * ha caricato: POST /cornice/notifiche/letture. `finoA` è un istante col suo fuso, come la `creata_il` di una notifica;
 * `workspace` è lo slug del workspace della pagina, quello per cui l'istante è stato calcolato: se la sessione è passata a un
 * altro (un'altra scheda) la parte server non segna niente. Una risposta senza `fino_a` è un errore come le altre. Dà
 * l'istante in cui la parte server le ha segnate (`segnate_il`): se manca, o ha un'altra forma, non è un errore, è senza segno.
 * E dice se ne restano (`altre`): la parte server si è fermata a un tetto, e la stessa richiesta continua da lì. Solo il
 * booleano `true` lo dice: una parte server di prima della `v1.3.0` non dà `altre`, e allora non ne restano.
 */
export async function segnaLetteFinoA(finoA: string, workspace: string): Promise<{ il: string | undefined; altre: boolean }> {
    const indirizzo = '/cornice/notifiche/letture';
    const corpo = (await chiama(indirizzo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...gettoneCsrf() },
        body: JSON.stringify({ fino_a: finoA, workspace }),
    })) as { data?: { fino_a?: unknown; altre?: unknown } | null; segnate_il?: unknown } | null;
    if (typeof corpo?.data?.fino_a !== 'string') {
        throw new Error(`POST ${indirizzo}: fino_a`);
    }

    return { il: segno(corpo.segnate_il), altre: corpo.data.altre === true };
}

/**
 * Le risorse del workspace che rispondono a `parola`, nell'ordine del backoffice (per titolo): POST /cornice/ricerca. La parola
 * sta nel corpo, mai nell'indirizzo di questa richiesta: ciò che una persona cerca non deve restare dove restano gli indirizzi
 * del browser (dal server del modulo al backoffice ci sta ancora, finché il backoffice non dà un metodo col termine nel
 * corpo). `segnale` annulla la richiesta.
 */
export async function cerca(parola: string, segnale: AbortSignal): Promise<RisultatoDellaRicerca[]> {
    const indirizzo = '/cornice/ricerca';
    const corpo = (await chiama(indirizzo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...gettoneCsrf() },
        body: JSON.stringify({ q: parola }),
        signal: segnale,
    })) as { data?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error(`POST ${indirizzo}: data`);
    }

    return corpo.data as RisultatoDellaRicerca[];
}

/** Il gettone CSRF di Laravel: il cookie `XSRF-TOKEN` della pagina, rimandato nell'header `X-XSRF-TOKEN` (senza, 419). */
function gettoneCsrf(): Record<string, string> {
    const nome = 'XSRF-TOKEN';
    const cookie = document.cookie.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`));

    return cookie === undefined ? {} : { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(nome.length + 1)) };
}
