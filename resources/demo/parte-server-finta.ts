import { HttpCancelledError, type HttpClient } from '@inertiajs/core';
import type { DatiDellaCornice } from '../js/cornice';

// La parte server della pagina di prova del layout, finta: ciò che un frontend ha dietro Inertia. A ogni visita risponde, dopo
// un attimo, la pagina che l'indirizzo dice, coi dati di una lettura nuova; e una lettura porta in `cornice` il segno
// `aggiornati_il`, come lo mette la parte server di zr-core, salvo con `?segno=no`. Una visita che Inertia annulla (un altro
// clic, Indietro) è rifiutata come fa il suo client vero: Inertia non scarta la risposta di una visita annullata, conta su quel
// rifiuto. La UAT del layout gira su questa parte server: la prova parte-server-finta.test.ts. Non entra nel pacchetto.

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
 * Il client HTTP da dare a Inertia (`http.setClient`): ogni visita arriva qui, si scrive in console, e dopo `attesa` millisecondi
 * la risposta è la pagina che `pagina` dà per l'indirizzo della richiesta. `pagina` gira quando la risposta è pronta, e non
 * gira per una visita annullata nel frattempo: quella è rifiutata con l'errore del client vero, che Inertia riconosce e ignora.
 * Come il client vero, l'annullo si ascolta da quando la richiesta arriva qui: una visita già annullata prima (due visite nello
 * stesso giro, che solo uno script fa) parte lo stesso, e Inertia monta la sua risposta.
 */
export function clientFinto(pagina: (indirizzo: URL) => { component: string; props: object }, attesa = 50): HttpClient {
    return {
        request: (richiesta) =>
            new Promise((risposta, rifiuto) => {
                const indirizzo = new URL(richiesta.url, window.location.href);
                const url = indirizzo.pathname + indirizzo.search;
                console.info('UAT visita', richiesta.method, url);
                const pronta = setTimeout(() => {
                    try {
                        risposta({ status: 200, data: JSON.stringify({ ...pagina(indirizzo), url, version: null }), headers: { 'x-inertia': 'true' } });
                    } catch (errore) {
                        rifiuto(errore);
                    }
                }, attesa);
                richiesta.signal?.addEventListener('abort', () => {
                    clearTimeout(pronta);
                    rifiuto(new HttpCancelledError('Request was cancelled', url));
                });
            }),
    };
}
