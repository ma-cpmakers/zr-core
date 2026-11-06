import { FORMA_DI_UN_ID } from './forme';

// Il trasporto delle chiamate della cornice alle rotte di zr-core (`/cornice/…`): chi chiede, chi è a schermo, il gettone CSRF
// e gli errori che la cornice distingue. Fino alla `v4.19` stava in `./servizi`, che lo riesporta; da qui lo prendono anche le
// due chiamate che segnano lette (`./letture`, nel pezzo della campanella), senza il caricatore della ricerca di `./servizi`,
// che a `resources/js/frasi` porterebbe il pezzo della ricerca.

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
    // Scritto dal costruttore: `declare` non dichiara il campo una seconda volta nel JS, e la proprietà è la stessa.
    declare readonly secondi: number;

    constructor(esito: string, secondi: number) {
        super(esito);
        this.secondi = secondi;
    }
}

/**
 * Chi la cornice mostra adesso, con l'email, o nessuno: lo dice la cornice quando si monta, e lo toglie quando si smonta
 * (dalla `v2.7.0`). «A schermo» è la cornice montata: non l'ultima disegnata — un disegno che React abbandona non scrive
 * niente —, e una pagina senza la cornice non ha nessuno a schermo. Dalla `v2.17.1` lo tiene una pila delle cornici montate:
 * `mostra(persona)` ci mette la cornice che si monta, `mostra(persona, 1)` toglie una voce sola, la sua, quando si smonta;
 * a schermo c'è l'ultima montata fra quelle rimaste. Così con due cornici della stessa persona, smontata una, a schermo resta la
 * persona dell'altra; e con due cornici di persone diverse, smontata quella di prima, resta l'altra (come dalla `v2.11.5`).
 * Dalla `v2.20.0` la pila tiene le persone (email e impronta di zr-auth), non le email: ogni cornice toglie la sua, e con A, poi
 * B, poi di nuovo A, smontata la A montata dopo B a schermo torna B (README, «La cornice in due dati»). `mostra(persona, 1)` si
 * chiama solo allo smontaggio della cornice che l'ha montata, con la stessa persona: con una mai montata `indexOf` darebbe -1,
 * e `splice` toglierebbe l'ultima voce, di un'altra.
 */
export let aSchermo: string | undefined;

/**
 * Chi chiede (dalla `v2.20.1`): l'email e l'impronta di zr-auth (`persona.impronta` dei dati) della cornice che fa la richiesta,
 * non di quella a schermo. Ogni richiesta porta l'email in `Persona` e l'impronta in `X-Zr-Persona`, e StessaPersona confronta
 * l'impronta con quella della sessione: con la sola email una scheda rimasta aperta di un altro account con la stessa email
 * passerebbe. Con due cornici montate insieme, stessa email e due account, ognuna manda la sua (nella `v2.20.0` tutte quella
 * dell'ultima montata). Senza impronta (dati di prima, o una `persona` costruita dal frontend) parte un testo che non è
 * un'impronta (`undefined` nel browser), mai l'impronta di un'altra cornice; dalla `v2.21.0`, se la sessione ne ha una, la
 * parte server lo rifiuta col 409 (fino alla `v2.20` confrontava solo l'email).
 */
export interface Persona {
    email: string;
    impronta?: string | null;
}

const montate: Persona[] = [];
export function mostra(persona: Persona, via?: 1): void {
    via ? montate.splice(montate.indexOf(persona), 1) : montate.push(persona);
    aSchermo = montate.at(-1)?.email;
}

/**
 * Una chiamata a una rotta della cornice. Ogni richiesta dice di chi è la pagina che chiede (dalla `v2.6.0`): l'intestazione
 * `Persona` porta l'email della persona della cornice che chiede (dalla `v2.20.1` con l'impronta, in `X-Zr-Persona`: vedi
 * `Persona` qui sopra), passata da `encodeURIComponent` — un'intestazione porta solo
 * caratteri di Latin-1, e con un altro `fetch` lancerebbe prima di partire —, e mai l'indirizzo. La parte server la confronta
 * con la sessione prima di ogni altro controllo: a una pagina rimasta ferma, con la sessione passata a un'altra persona,
 * risponde 409 `persona_diversa` senza leggere né segnare niente (dalla `v2.23.0`, con la stessa impronta, passa anche con l'email di
 * prima, e la risposta dice `persona` com'è nella pagina). `dati` va nel corpo, in JSON; `Content-Type` e il gettone
 * CSRF partono con ogni richiesta, anche con la `GET` che non ha un corpo.
 *
 * Il corpo JSON si legge di ogni risposta, anche di un errore: una rotta dice di chi è
 * la sua risposta (`persona`, l'email della persona della sessione che ha risposto: dalla `v2.4.0` l'elenco delle notifiche e
 * la ricerca, dalla `v2.5.0` anche i loro 403 `accettazione_richiesta`, il 429 della ricerca e il 409 `persona_diversa`,
 * che dalla `v2.6.0` è di tutte e quattro le rotte, e dalla `v2.10.0` alla `v2.11` il 403 `gettone_senza_workspace`; dalla
 * `v2.12.0` il 409 porta `persona` vuota, che non è l'email di nessuno, e il 403 non la porta più: arriva solo alla persona
 * della sessione). Con l'email di chi chiede una risposta di un'altra persona (un'altra email: lo scarto guarda la sola email;
 * fra due account con la stessa email protegge il 409 della parte server, quando l'impronta c'è) non torna a chi
 * l'ha chiesta, né coi dati né con un errore: la sessione è passata a un'altra persona con la pagina ferma, e la pagina si
 * ricarica — dopo, è di chi è entrato. Si ricarica solo se a schermo c'è una cornice che non è di chi ha risposto (`mostra`,
 * dalla `v2.7.0`): se una visita ha già portato chi è entrato, la risposta in ritardo non ricarica la sua pagina, e non
 * ricarica una pagina senza la cornice (ciò che è a schermo quando arriva la risposta: allo scadere dei 30 secondi vale ciò
 * che è detto sotto); se chi ha risposto è una terza persona, sì. Fino al ricaricamento chi ha chiesto resta in attesa, e
 * niente di quella risposta va a schermo, nemmeno la cornice ridotta o il freno della ricerca. Se dopo 5 secondi la pagina è
 * ancora lì — un `beforeunload` che annulla il ricaricamento, una pagina nuova che tarda, o una pagina che non ha ancora
 * l'età per ricaricarsi — la promessa si chiude con un errore senza niente dentro (dalla
 * `v2.9.0`): né i dati, né `persona`, né la classe dell'errore di chi è entrato, e chi ha chiamato dice il suo errore di
 * sempre. Se la pagina non si ricarica perché non deve (nessuno a schermo, o c'è già chi ha risposto) nessun orologio parte, e
 * la promessa resta aperta: chi l'ha chiesta non è più a schermo. La ricarica ha un tetto, l'età della pagina (dalla
 * `v2.9.0`): una pagina caricata da meno di 30 secondi non si ricarica prima di compierli — subito dopo una ricarica, se la
 * risposta dice ancora un'altra persona, rifarla non cambia niente. Dalla `v2.10.0` si ricarica da sola quando li compie: la
 * ricarica la chiede un orologio — su una pagina di 30 secondi o più scade al primo giro: un ritardo negativo vale zero —,
 * e allo scadere riguarda chi è a schermo. Se una visita ha già portato chi ha risposto, la sua pagina non si ricarica; una
 * pagina rimasta senza cornice sì. Subito prima di ricaricarla manda sulla `window` l'evento `zr-core:altra-persona` (dalla
 * `v2.13.0`): il frontend, se vuole, dopo la ricarica dice perché la pagina si è aggiornata (README). Il 409 con `persona` vuota non dice chi ha risposto: con una cornice a schermo la pagina
 * si ricarica anche se una visita ha già portato un'altra persona. Fino allo scadere l'orologio tiene della risposta solo chi ha risposto (`chi`, dalla `v2.11.3`):
 * il resto si butta subito. L'orologio dei 5 secondi parte per primo: scambiati, due pezzi a richiesta passano il
 * loro tetto. Niente
 * è scritto nel browser per ricordarlo: l'orologio è quello della pagina (`performance.now()`). Una risposta che non lo dice
 * con un testo (una parte server di prima) vale com'è: nessun ricaricamento. Una risposta 200 senza un corpo JSON torna
 * `null`, e l'errore lo dà chi ha chiamato.
 */
export async function chiama(indirizzo: string, { email, impronta }: Persona, method?: string, dati?: object, altro?: { signal?: AbortSignal; keepalive?: boolean }): Promise<unknown> {
    // Per `fetch` un `method` o un `body` che è `undefined` è come se mancasse: la `GET` parte senza corpo.
    const risposta = await fetch(indirizzo, { method, ...altro, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Zr-Persona': impronta!, Persona: encodeURIComponent(email), ...gettoneCsrf() }, body: dati && JSON.stringify(dati) } as RequestInit);
    const corpo = (await risposta.json().catch(() => null)) as { errore?: unknown; codice?: unknown; persona?: unknown } | null;
    const chi = corpo?.persona;
    if (email && typeof chi === 'string' && chi !== email) {
        return new Promise<never>((_, no) => aSchermo && chi !== aSchermo && (setTimeout(no, 5e3), setTimeout(() => chi !== aSchermo && (dispatchEvent(new Event('zr-core:altra-persona')), location.reload()), 3e4 - performance.now())));
    }
    if (!risposta.ok) {
        const esito = `${method ?? 'GET'} ${indirizzo}: ${risposta.status}`;
        // Solo quel codice cambia l'errore di un 403 — quello che una rotta della cornice dà al suo errore (`errore`), o quello
        // che dà zr-auth quando risponde da sé (`codice`) —: un 403 con un altro codice (la sessione senza workspace, quando è
        // della persona a schermo: di un'altra vale ciò che è sopra), o lo stesso codice con un altro stato, restano l'errore di sempre.
        if (risposta.status === 403 && [corpo?.errore, corpo?.codice].includes('accettazione_richiesta')) {
            throw new AccettazioneRichiesta(esito);
        }
        if (risposta.status === 429) {
            // Senza l'header è `null`, che `test` legge come «null»: non è un intero, e l'errore resta quello di sempre. Un intero è
            // da 1 in su se non è zero (`+'00'` è 0).
            const riprovaFra = risposta.headers.get('Retry-After') as string;
            if (/^\d+$/.test(riprovaFra) && +riprovaFra) {
                throw new TroppeRichieste(esito, +riprovaFra);
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
 * Se un id ha la forma che le rotte delle notifiche vogliono (`FORMA_DI_UN_ID`): la usa `segnaLetta`, nel pezzo della campanella.
 * Sta qui, che è nel JS d'ingresso, perché la forma resti lì: la usano anche il pezzo della campanella e quello della ricerca, e senza un
 * uso nell'ingresso diventerebbe un terzo file a richiesta.
 */
export const haLaFormaDiUnId = (id: unknown): id is string => typeof id === 'string' && FORMA_DI_UN_ID.test(id);

/** Il gettone CSRF di Laravel: il cookie `XSRF-TOKEN` della pagina, rimandato nell'header `X-XSRF-TOKEN` (senza, 419). */
function gettoneCsrf(): Record<string, string> {
    const nome = 'XSRF-TOKEN';
    // `document.cookie` separa le coppie con «; », senza spazi attorno a nome e valore (RFC 6265, §5.4).
    const cookie = document.cookie.split('; ').find((parte) => parte.startsWith(`${nome}=`));

    return cookie ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(nome.length + 1)) } : {};
}
