// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

/** Una notifica come la dà GET /cornice/notifiche: il contratto non dice di che prodotto è, né per chi. */
export interface NotificaDellaCornice {
    id: string;
    /** Un istante RFC 3339, con l'ora e il fuso. */
    creata_il: string;
    letta: boolean;
}

/** Un risultato della ricerca come lo dà GET /cornice/ricerca. */
export interface RisultatoDellaRicerca {
    /** Il codice dell'app nel backoffice: l'id del prodotto nel registro. */
    app: string;
    /** Il tipo della risorsa nell'app: una risorsa del prodotto nel registro. */
    tipo: string;
    id: string | number;
    titolo: string;
}

async function chiama(indirizzo: string, opzioni: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}): Promise<unknown> {
    const risposta = await fetch(indirizzo, { ...opzioni, headers: { Accept: 'application/json', ...opzioni.headers } });
    if (!risposta.ok) {
        throw new Error(`${opzioni.method ?? 'GET'} ${indirizzo}: ${risposta.status}`);
    }

    return risposta.json();
}

/** Le notifiche del workspace, dalla più recente: GET /cornice/notifiche. */
export async function caricaNotifiche(): Promise<NotificaDellaCornice[]> {
    const corpo = (await chiama('/cornice/notifiche')) as { data?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error('GET /cornice/notifiche: data');
    }

    return corpo.data as NotificaDellaCornice[];
}

/**
 * Segna letta una notifica: PATCH /cornice/notifiche/<id>/lettura. L'id entra nell'indirizzo codificato, e una risposta che non
 * la dà per letta è un errore come le altre.
 */
export async function segnaLetta(id: string): Promise<void> {
    const indirizzo = `/cornice/notifiche/${encodeURIComponent(id)}/lettura`;
    const corpo = (await chiama(indirizzo, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...gettoneCsrf() },
        body: JSON.stringify({ letta: true }),
    })) as { data?: { letta?: unknown } | null } | null;
    if (corpo?.data?.letta !== true) {
        throw new Error(`PATCH ${indirizzo}: letta`);
    }
}

/** Le risorse del workspace che rispondono a `parola`, per pertinenza: GET /cornice/ricerca?q=. `segnale` annulla la richiesta. */
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
