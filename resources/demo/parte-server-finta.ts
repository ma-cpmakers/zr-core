import { HttpCancelledError, type HttpClient } from '@inertiajs/core';
import type { DatiDellaCornice, DatiDopo, DatiSubito } from '../js/cornice';

// La parte server della pagina di prova del layout, finta: ciò che un frontend ha dietro Inertia. A ogni visita risponde, dopo
// un attimo, la pagina che l'indirizzo dice, coi dati di una lettura nuova; e una lettura porta in `cornice` il segno
// `aggiornati_il`, come lo mette la parte server di zr-core, salvo con `?segno=no`. I dati si leggono quando la visita arriva,
// come fa una parte server vera, e la risposta parte dopo: con `lenta=<ms>` nell'indirizzo molto dopo, e porta i dati di
// allora. Una visita che Inertia annulla (un altro clic, Indietro) è rifiutata come fa il suo client vero: Inertia non scarta
// la risposta di una visita annullata, conta su quel rifiuto. La UAT del layout gira su questa parte server: la prova
// parte-server-finta.test.ts. Non entra nel pacchetto.

/** `?segno=no` nei parametri dell'indirizzo: i dati senza `aggiornati_il`, come li dava la parte server della `v1.2.0`. */
export function colSegno(parametri: string): boolean {
    return new URLSearchParams(parametri).get('segno') !== 'no';
}

let ultimaLettura = 0;

/**
 * L'istante di una lettura, come lo scrive la parte server in `aggiornati_il`: in UTC, coi microsecondi a sei cifre, e sempre
 * dopo quello della lettura di prima (due risposte nello stesso istante hanno comunque due segni).
 */
export function istanteDellaLettura(): string {
    ultimaLettura = Math.max(Math.round((performance.timeOrigin + performance.now()) * 1000), ultimaLettura + 1);

    return new Date(Math.floor(ultimaLettura / 1000)).toISOString().replace('Z', `${String(ultimaLettura % 1000).padStart(3, '0')}Z`);
}

/**
 * Ciò che la parte server legge per una risposta: una copia nuova ogni volta, col segno di quella lettura nei dati della
 * cornice (`segno` falso: senza). Alla pagina arriva l'oggetto di prima quando Inertia trova i dati uguali.
 */
export function lettura<Props extends { cornice: DatiDellaCornice | null }>(props: Props, segno: boolean): Props {
    const letta = structuredClone(props);
    if (letta.cornice !== null && segno) {
        letta.cornice.aggiornati_il = istanteDellaLettura();
    }

    return letta;
}

/**
 * Chi è entrato dopo, nella «sessione» della parte server finta: ciò che la sessione dice di lei, ciò che il backoffice dà per
 * lei e, se non è nel workspace della pagina, il suo. Senza la persona è quella che c'era, con un'altra lingua, e ciò che il
 * backoffice non dà per lei resta quello della pagina.
 */
export interface Entrata {
    sessione: Pick<DatiDellaCornice, 'lingua'> & Partial<Pick<DatiDellaCornice, 'persona'>>;
    backoffice: Partial<Pick<DatiDellaCornice, 'prodotti' | 'aziende' | 'non_lette' | 'accettazione_richiesta'>>;
    workspace?: DatiDellaCornice['workspace'];
}

/**
 * Ciò che la parte server ha letto, con la sessione di adesso: se è entrata un'altra persona i dati della cornice sono i suoi,
 * nelle tre forme in cui una pagina li riceve (interi, della sessione, del backoffice), e se è su un altro workspace lo dicono
 * tutte e tre. `dopo` dice di chi è, come `Cornice::dopo()` dalla `v2.4.0`: porta la persona e la lingua di chi è entrato.
 * Le forme ridotte di `dopo` restano ridotte: senza aziende non prende i dati del backoffice — `non_letti` dice di chi è
 * (dalla `v2.7.0`) e niente altro —, e senza workspace (un `non_letti` composto a mano) resta com'è. Se non è entrato
 * nessun altro la lettura è quella data.
 */
export function conLaSessione<Props extends { cornice: DatiDellaCornice | null; subito?: DatiSubito | null | undefined; dopo?: DatiDopo | null | undefined }>(
    letta: Props,
    entrata: Entrata | undefined,
): Props {
    if (entrata === undefined) {
        return letta;
    }
    const { sessione, backoffice, workspace } = entrata;
    const altrove = workspace ? { workspace } : {};

    return {
        ...letta,
        ...(letta.cornice ? { cornice: { ...letta.cornice, ...sessione, ...backoffice, ...altrove } } : {}),
        ...(letta.subito ? { subito: { ...letta.subito, ...sessione, ...altrove } } : {}),
        ...(letta.dopo?.workspace ? { dopo: { ...letta.dopo, ...sessione, ...(letta.dopo.aziende?.length ? backoffice : {}), ...altrove } } : {}),
    };
}

/** Dove la pagina di prova scrive chi è entrato: nel `localStorage`, che è del browser e non della scheda. */
export const chiaveDellaSessione = 'uat-persona';

/**
 * La «sessione» della parte server finta nei suoi stati: chi è entrato adesso, secondo ciò che i pulsanti della pagina di prova
 * hanno scritto nel `localStorage`. Senza un valore, o con uno che non è di questi, c'è la prima persona e la lettura resta
 * com'è. `altra`: un'altra persona nello stesso workspace. `altrove`: la stessa su un altro workspace, che è anche quello delle
 * sue aziende. `lingua`: la persona che c'è, con un'altra lingua e nient'altro di diverso. Gli stati si escludono: la chiave
 * è una e vale l'ultimo scritto, così `lingua` dopo `altra` rimette la persona della pagina.
 */
export function sessioneFinta(altra: Entrata, altrove: NonNullable<Entrata['workspace']>, altraLingua: string): () => Entrata | undefined {
    const entrate = new Map<string, Entrata>([
        ['altra', altra],
        ['altrove', {
            ...altra,
            backoffice: { ...altra.backoffice, aziende: (altra.backoffice.aziende ?? []).map((azienda) => ({ ...azienda, workspace: [{ id: 'uat-ws-9', ...altrove }] })) },
            workspace: altrove,
        }],
        ['lingua', { sessione: { lingua: altraLingua }, backoffice: {} }],
    ]);

    return () => entrate.get(localStorage.getItem(chiaveDellaSessione) ?? '');
}

/** Quanto aspetta la risposta di una visita: i millisecondi di `lenta` nel suo indirizzo, se sono un numero intero; se no `attesa`. */
function attesaDi(indirizzo: URL, attesa: number): number {
    const lenta = indirizzo.searchParams.get('lenta') ?? '';

    return /^\d+$/.test(lenta) ? Number(lenta) : attesa;
}

/**
 * Le props che un ricaricamento parziale chiede (`only`), come le nomina Inertia nella richiesta: separate da virgole. Una
 * parte server vera rimanda solo quelle, e le altre restano nella pagina quelle di prima. Una visita intera le ha tutte.
 */
function soloLeChieste(props: object, chieste: unknown): object {
    if (typeof chieste !== 'string' || chieste === '') {
        return props;
    }
    const nomi = chieste.split(',');

    return Object.fromEntries(Object.entries(props).filter(([nome]) => nomi.includes(nome)));
}

/**
 * Il client HTTP da dare a Inertia (`http.setClient`): ogni visita arriva qui e si scrive in console. La parte server ha due
 * tempi. `leggi` gira subito, quando la visita arriva: lì si leggono i dati, col segno di quell'istante. Ciò che `leggi` dà
 * gira quando la risposta è pronta — dopo `attesa` millisecondi, o dopo quelli di `lenta=<ms>` nell'indirizzo — e dà la pagina
 * da rispondere: lì si conta ciò che vale solo per una risposta consegnata. Non gira per una visita annullata nel frattempo:
 * quella è rifiutata con l'errore del client vero, che Inertia riconosce e ignora. Come il client vero, l'annullo si ascolta da
 * quando la richiesta arriva qui: una visita già annullata prima (due visite nello stesso giro, che solo uno script fa) parte
 * lo stesso, e Inertia monta la sua risposta.
 */
export function clientFinto(leggi: (indirizzo: URL) => () => { component: string; props: object }, attesa = 50): HttpClient {
    return {
        request: (richiesta) =>
            new Promise((risposta, rifiuto) => {
                const indirizzo = new URL(richiesta.url, window.location.href);
                const url = indirizzo.pathname + indirizzo.search;
                console.info('UAT visita', richiesta.method, url);
                const consegna = leggi(indirizzo);
                const pronta = setTimeout(() => {
                    try {
                        const { component, props } = consegna();
                        risposta({ status: 200, data: JSON.stringify({ component, props: soloLeChieste(props, richiesta.headers?.['X-Inertia-Partial-Data']), url, version: null }), headers: { 'x-inertia': 'true' } });
                    } catch (errore) {
                        rifiuto(errore);
                    }
                }, attesaDi(indirizzo, attesa));
                richiesta.signal?.addEventListener('abort', () => {
                    clearTimeout(pronta);
                    rifiuto(new HttpCancelledError('Request was cancelled', url));
                });
            }),
    };
}
