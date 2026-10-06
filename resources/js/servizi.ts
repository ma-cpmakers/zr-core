// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

/** Una notifica come la dà GET /cornice/notifiche. */
export interface NotificaDellaCornice {
    id: string | number;
    /** Un istante RFC 3339, con l'ora e il fuso. */
    creata_il: string;
    letta: boolean;
    per_me: boolean;
    motivo: string;
    /** Il codice dell'app nel backoffice: l'id del prodotto nel registro. */
    app: string;
}

async function chiama(indirizzo: string, opzioni: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<unknown> {
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

/** Segna lette le notifiche del workspace fino a `finoA`, un istante con ora e fuso: PATCH /cornice/notifiche/lettura. */
export async function segnaLette(finoA: string): Promise<void> {
    await chiama('/cornice/notifiche/lettura', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...gettoneCsrf() },
        body: JSON.stringify({ fino_a: finoA }),
    });
}

/** Il gettone CSRF di Laravel: il cookie `XSRF-TOKEN` della pagina, rimandato nell'header `X-XSRF-TOKEN` (senza, 419). */
function gettoneCsrf(): Record<string, string> {
    const nome = 'XSRF-TOKEN';
    const cookie = document.cookie.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`));

    return cookie === undefined ? {} : { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(nome.length + 1)) };
}
