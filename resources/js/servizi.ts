// Le chiamate della cornice alle rotte di zr-core (`/cornice/…`), sulla stessa origine della pagina: la sessione viaggia col suo
// cookie, e il gettone del backoffice resta nella parte server. Una risposta che non è un 2xx, o non ha la forma attesa, è un
// errore: mai una lista vuota.

import { FORMA_DI_UN_ID } from './forme';
import { pezzoARichiesta } from './lingue';

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
     * `v1.15.0` non lo dà, e vale come `null`.
     */
    contesto?: Record<string, string | null> | null | undefined;
}

/**
 * Una rotta della cornice ha risposto 403 `{"errore": "accettazione_richiesta"}`: la persona non ha ancora accettato i documenti
 * legali in vigore, e finché non lo fa il backoffice non dà né notifiche né ricerca (dalla `v1.14.0`). Per la cornice non è un
 * guasto: passa allo stato ridotto, con l'avviso che porta alla pagina dell'accettazione. Per chi non la guarda è un errore
 * come gli altri. Vale lo stesso il 403 col codice in `codice`, la forma con cui zr-auth risponde da sé a una richiesta JSON:
 * arriva al browser se un middleware del frontend chiama il backoffice anche su una rotta della cornice senza prendere
 * quell'errore.
 */
export class AccettazioneRichiesta extends Error {}

/**
 * Una rotta della cornice ha risposto 429 dicendo fra quanti secondi riprovare (`Retry-After`, un intero da 1 in su): il
 * backoffice frena le richieste della persona — oggi le ricerche —, e la parte server lo ripete al browser coi secondi che ha
 * detto lui. `secondi` è quel numero, com'è: quanto fidarsene lo decide chi ha chiamato (la cornice ferma la ricerca per quei
 * secondi, al più 60). Per chi non la guarda è un errore come gli altri. Un 429 senza `Retry-After`, o con un valore che non
 * è un intero da 1 in su — `0`, un numero con la virgola, una data —, resta l'errore di sempre, e così ogni altro stato.
 */
export class TroppeRichieste extends Error {
    readonly secondi: number;

    constructor(esito: string, secondi: number) {
        super(esito);
        this.secondi = secondi;
    }
}

/**
 * Chi la cornice mostra adesso, con l'email, o nessuno: lo dice la cornice quando si monta, e lo toglie quando si smonta
 * (dalla `v2.7.0`; chiamata senza niente, toglie). «A schermo» è la cornice montata: non l'ultima disegnata — un disegno
 * che React abbandona non scrive niente —, e una pagina senza la cornice non ha nessuno a schermo.
 */
export let aSchermo: string | undefined;

export function mostra(email?: string): void {
    aSchermo = email;
}

/**
 * Una chiamata a una rotta della cornice. Ogni richiesta dice di chi è la pagina che chiede (dalla `v2.6.0`): l'intestazione
 * `Persona` porta `email`, quella di chi la cornice mostra, passata da `encodeURIComponent` — un'intestazione porta solo
 * caratteri di Latin-1, e con un altro `fetch` lancerebbe prima di partire —, e mai l'indirizzo. La parte server la confronta
 * con la sessione prima di ogni altro controllo: a una pagina rimasta ferma, con la sessione passata a un'altra persona,
 * risponde 409 `persona_diversa` senza leggere né segnare niente. `dati` va nel corpo, in JSON; `Content-Type` e il gettone
 * CSRF partono con ogni richiesta, anche con la `GET` che non ha un corpo.
 *
 * Il corpo JSON si legge di ogni risposta, anche di un errore: una rotta dice di chi è
 * la sua risposta (`persona`, l'email della persona della sessione che ha risposto: dalla `v2.4.0` l'elenco delle notifiche e
 * la ricerca, dalla `v2.5.0` anche i loro 403 `accettazione_richiesta`, il 429 della ricerca e il 409 `persona_diversa`,
 * che dalla `v2.6.0` è di tutte e quattro le rotte). Con `email` una risposta di un'altra persona non torna a chi
 * l'ha chiesta, né coi dati né con un errore: la sessione è passata a un'altra persona con la pagina ferma, e la pagina si
 * ricarica — dopo, è di chi è entrato. Si ricarica solo se a schermo c'è una cornice che non è di chi ha risposto (`mostra`,
 * dalla `v2.7.0`): se una visita ha già portato chi è entrato, la risposta in ritardo non ricarica la sua pagina, e non
 * ricarica una pagina senza la cornice; se chi ha risposto è una terza persona, sì. Fino al ricaricamento chi ha chiesto resta in attesa, e
 * niente di quella risposta va a schermo, nemmeno la cornice ridotta o il freno della ricerca. Se dopo 5 secondi la pagina è
 * ancora lì — un `beforeunload` che annulla il ricaricamento — la promessa si chiude con un errore senza niente dentro (dalla
 * `v2.9.0`): né i dati, né `persona`, né la classe dell'errore di chi è entrato, e chi ha chiamato dice il suo errore di
 * sempre. Se la pagina non si ricarica perché non deve (nessuno a schermo, o c'è già chi ha risposto) nessun orologio parte, e
 * la promessa resta aperta: chi l'ha chiesta non è più a schermo. La ricarica ha un tetto, l'età della pagina (dalla
 * `v2.9.0`): una pagina caricata da meno di 30 secondi non si ricarica — subito dopo una ricarica, se la risposta dice ancora
 * un'altra persona, rifarla non cambia niente — e la promessa si chiude subito con lo stesso errore senza niente dentro. Niente
 * è scritto nel browser per ricordarlo: l'orologio è quello della pagina (`performance.now()`). Una risposta che non lo dice
 * con un testo (una parte server di prima) vale com'è: nessun ricaricamento. Una risposta 200 senza un corpo JSON torna
 * `null`, e l'errore lo dà chi ha chiamato.
 */
export async function chiama(indirizzo: string, email: string, method?: string, dati?: object, altro?: { signal?: AbortSignal; keepalive?: boolean }): Promise<unknown> {
    // Per `fetch` un `method` o un `body` che è `undefined` è come se mancasse: la `GET` parte senza corpo.
    const risposta = await fetch(indirizzo, { method, ...altro, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Persona: encodeURIComponent(email), ...gettoneCsrf() }, body: dati && JSON.stringify(dati) } as RequestInit);
    const corpo = (await risposta.json().catch(() => null)) as { errore?: unknown; codice?: unknown; persona?: unknown } | null;
    if (email && typeof corpo?.persona === 'string' && corpo.persona !== email) {
        return new Promise<never>((_, no) => aSchermo && corpo.persona !== aSchermo && (performance.now() < 3e4 ? no() : (location.reload(), setTimeout(no, 5e3))));
    }
    if (!risposta.ok) {
        const esito = `${method ?? 'GET'} ${indirizzo}: ${risposta.status}`;
        // Solo quel codice cambia l'errore di un 403 — quello che una rotta della cornice dà al suo errore (`errore`), o quello
        // che dà zr-auth quando risponde da sé (`codice`) —: un 403 con un altro codice (la sessione senza workspace), o lo
        // stesso codice con un altro stato, restano l'errore di sempre.
        if (risposta.status === 403 && [corpo?.errore, corpo?.codice].includes('accettazione_richiesta')) {
            throw new AccettazioneRichiesta(esito);
        }
        if (risposta.status === 429) {
            const riprovaFra = risposta.headers.get('Retry-After') ?? '';
            if (/^\d+$/.test(riprovaFra) && Number(riprovaFra) >= 1) {
                throw new TroppeRichieste(esito, Number(riprovaFra));
            }
        }
        throw new Error(esito);
    }

    return corpo;
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
 * `workspace` è lo slug del workspace di cui sono, come lo dice la parte server (dalla `v1.12.0`): quello della sessione, che
 * non è sempre quello della pagina. Se la risposta non lo dice, o non lo dice con un testo, non è un errore: non si sa.
 * `email` è quella di chi la cornice mostra: un elenco, o un errore, di un'altra persona non torna (`chiama`).
 */
export async function caricaNotifiche(email: string): Promise<{ elenco: NotificaDellaCornice[]; il: string | undefined; workspace: string | undefined }> {
    const corpo = (await chiama('/cornice/notifiche', email)) as { data?: unknown; aggiornati_il?: unknown; workspace?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error('GET /cornice/notifiche: data');
    }

    return { elenco: corpo.data as NotificaDellaCornice[], il: segno(corpo.aggiornati_il), workspace: typeof corpo.workspace === 'string' ? corpo.workspace : undefined };
}

/**
 * Segna lette, con una richiesta sola, le notifiche della persona nate fino a `finoA` compreso, anche quelle che la cornice non
 * ha caricato: POST /cornice/notifiche/letture. `finoA` è un istante col suo fuso, come la `creata_il` di una notifica;
 * `workspace` è lo slug del workspace della pagina, quello per cui l'istante è stato calcolato: se la sessione è passata a un
 * altro (un'altra scheda) la parte server non segna niente. `persona` è l'email di chi la cornice mostra, e dalla `v2.6.0` parte
 * nell'intestazione come per le altre richieste, non più nel corpo: se la sessione è passata a un'altra persona (una scheda
 * rimasta ferma) la parte server non segna niente nemmeno lì, lo dice con l'email di chi è entrato, e la pagina si ricarica
 * (`chiama`). Una risposta senza `fino_a` è un errore come le altre. Dà
 * l'istante in cui la parte server le ha segnate (`segnate_il`): se manca, o ha un'altra forma, non è un errore, è senza segno.
 * E dice se ne restano (`altre`): la parte server si è fermata a un tetto, e la stessa richiesta continua da lì. Solo il
 * booleano `true` lo dice: una parte server di prima della `v1.3.0` non dà `altre`, e allora non ne restano.
 */
export async function segnaLetteFinoA(finoA: string, workspace: string, persona: string): Promise<{ il: string | undefined; altre: boolean }> {
    const indirizzo = '/cornice/notifiche/letture';
    const corpo = (await chiama(indirizzo, persona, 'POST', { workspace, fino_a: finoA })) as { data?: { fino_a?: unknown; altre?: unknown } | null; segnate_il?: unknown } | null;
    if (typeof corpo?.data?.fino_a !== 'string') {
        throw new Error(`POST ${indirizzo}: fino_a`);
    }

    return { il: segno(corpo.segnate_il), altre: corpo.data.altre === true };
}

/**
 * Segna letta una notifica della persona: PATCH /cornice/notifiche/<id>/lettura con `{"letta": true}`. La cornice la chiama col
 * clic che apre la risorsa di una notifica non letta, e subito dopo apre un'altra pagina: la richiesta parte nello stesso giro
 * di chi la chiama, e con `keepalive` il browser la porta in fondo anche se la pagina se ne va. L'id sta nel suo pezzo
 * dell'indirizzo, e prima di chiedere deve avere la forma che la rotta vuole: `encodeURIComponent` non tocca i punti, e con
 * `.` o `..` il browser porterebbe la richiesta, col gettone CSRF, a un'altra rotta. Senza quella forma la richiesta non
 * parte, ed è una lettura non riuscita. Solo una risposta che dice `letta: true` è una lettura riuscita: ogni altra è un
 * errore, come una che non è un 2xx. Dà l'istante in cui la parte server l'ha segnata (`segnata_il`, dalla `v1.12.0`): se
 * manca, o ha un'altra forma, non è un errore, è senza segno. `email` è quella di chi la cornice mostra: se la sessione è
 * passata a un'altra persona la parte server non segna la notifica a chi è entrato (409 `persona_diversa`, dalla `v2.6.0`), e
 * né quel 409 né il 403 `accettazione_richiesta` di un'altra persona tornano a chi ha chiesto: la pagina, se è ancora lì, si
 * ricarica (vedi `chiama`).
 */
export async function segnaLetta(id: string, email: string): Promise<{ il: string | undefined }> {
    // L'id arriva da un elenco che la parte server ha dato, con una conversione di tipo e non con un controllo: se non è un testo
    // un'espressione regolare lo converte da sé, e `null` o un numero hanno la forma di un id.
    if (typeof id !== 'string' || !FORMA_DI_UN_ID.test(id)) {
        throw new Error('PATCH /cornice/notifiche/{id}/lettura: id');
    }
    const indirizzo = `/cornice/notifiche/${encodeURIComponent(id)}/lettura`;
    const corpo = (await chiama(indirizzo, email, 'PATCH', { letta: true }, { keepalive: true })) as { data?: { letta?: unknown } | null; segnata_il?: unknown } | null;
    if (corpo?.data?.letta !== true) {
        throw new Error(`PATCH ${indirizzo}: letta`);
    }

    return { il: segno(corpo.segnata_il) };
}

/** Il pezzo a richiesta con la ricerca della cornice (`./ricerca`, dalla `v2.8.0`): niente finché non è arrivato. */
export let ricerca: typeof import('./ricerca') | undefined;

const ilPezzoDellaRicerca = pezzoARichiesta<typeof import('./ricerca')>(() => import('./ricerca'), (daLi) => import(/* @vite-ignore */ daLi), import.meta.url);

/**
 * Chiede il pezzo della ricerca, e quando è arrivato lo tiene (`ricerca`). La cornice lo chiede al primo fuoco nel campo della
 * ricerca, o alla prima parola, mai al montaggio. Se non arriva la promessa è respinta e niente resta: la richiesta dopo lo
 * richiede, come per la campanella (`pezzoARichiesta`, in `lingue.ts`). Arrivato, non si chiede più. Sta qui e non in `lingue.ts`, che è anche di chi prende solo le frasi (`resources/js/frasi`):
 * lì un pezzo della ricerca non serve.
 */
export const chiediLaRicerca = async () => (ricerca ??= await ilPezzoDellaRicerca());

/** Il gettone CSRF di Laravel: il cookie `XSRF-TOKEN` della pagina, rimandato nell'header `X-XSRF-TOKEN` (senza, 419). */
function gettoneCsrf(): Record<string, string> {
    const nome = 'XSRF-TOKEN';
    const cookie = document.cookie.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`));

    return cookie === undefined ? {} : { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(nome.length + 1)) };
}
