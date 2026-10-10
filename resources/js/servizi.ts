// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

/** Una notifica come la dà GET /cornice/notifiche: il contratto non dice per chi è. */
export interface NotificaDellaCornice {
    id: string;
    /** Un istante RFC 3339, con l'ora e il fuso. */
    creata_il: string;
    letta: boolean;
    /** Il codice dell'app da cui viene (`pm`, `crm`…), com'è nel backoffice: `null` se non è di un'app. Di che prodotto è, e come si mostra, lo dice il registro. */
    app: string | null;
    /** Il tipo dell'evento che l'ha generata (`com.zeiras.board.scheda.creata`…), com'è nel backoffice: che titolo ha lo dicono le lingue. La parte server lo dà sempre; senza, il titolo è quello di ripiego. */
    tipo?: string;
}

/** Un risultato della ricerca come lo dà GET /cornice/ricerca: il contratto non dice di che prodotto è. */
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
 */
export async function segnaLetteFinoA(finoA: string, workspace: string): Promise<string | undefined> {
    const indirizzo = '/cornice/notifiche/letture';
    const corpo = (await chiama(indirizzo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...gettoneCsrf() },
        body: JSON.stringify({ fino_a: finoA, workspace }),
    })) as { data?: { fino_a?: unknown } | null; segnate_il?: unknown } | null;
    if (typeof corpo?.data?.fino_a !== 'string') {
        throw new Error(`POST ${indirizzo}: fino_a`);
    }

    return segno(corpo.segnate_il);
}

/** Le risorse del workspace che rispondono a `parola`, nell'ordine del backoffice (per titolo): GET /cornice/ricerca?q=. `segnale` annulla la richiesta. */
export async function cerca(parola: string, segnale: AbortSignal): Promise<RisultatoDellaRicerca[]> {
    const corpo = (await chiama(`/cornice/ricerca?q=${encodeURIComponent(parola)}`, { signal: segnale })) as { data?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error('GET /cornice/ricerca: data');
    }

    return corpo.data as RisultatoDellaRicerca[];
}

/** Il gettone CSRF di Laravel: il cookie `XSRF-TOKEN` della pagina, rimandato nell'header `X-XSRF-TOKEN` (senza, 419). */
function gettoneCsrf(): Record<string, string> {
    const nome = 'XSRF-TOKEN';
    const cookie = document.cookie.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`));

    return cookie === undefined ? {} : { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(nome.length + 1)) };
}
