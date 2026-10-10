import { HttpCancelledError } from '@inertiajs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatiDellaCornice } from '../js/cornice';
import { clientFinto, colSegno, lettura } from './parte-server-finta';

// Sprint 10 · T3 (voce #1453), dopo la review della PR. La UAT del layout gira sulla pagina di prova, e ciò che lì fa la parte
// server lo fa questo file: se smette di mettere il segno a ogni lettura, se `?segno=no` non lo toglie più, o se risponde a una
// visita che Inertia ha annullato, la pagina di prova mostra un comportamento che il prodotto non ha, e le righe della UAT non
// distinguono più. La pagina di prova lo usa così com'è: lo lega tests/Feature/PacchettoTest.php.
//
// Sprint 11 · T3 (voce #1458). Una parte server vera legge i dati quando la visita le arriva, e la risposta parte dopo: una
// risposta lenta porta i dati di allora. Qui lo stesso: `leggi` gira all'arrivo, ciò che dà gira quando la risposta è pronta,
// e un indirizzo con `lenta=<ms>` aspetta quei millisecondi. Se la lettura si facesse alla consegna, una visita lenta
// porterebbe il segno di adesso e la UAT non vedrebbe più una risposta letta prima di un'azione e arrivata dopo.

const marketing: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' },
    workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile' },
    aziende: [{ id: 'uat-1', nome: 'UAT Acme', workspace: [{ nome: 'UAT Marketing', slug: 'uat-marketing' }] }],
    non_lette: 7,
};

/** Ciò che la pagina di prova dà a una pagina: i dati della cornice e il resto. */
const props = (): { cornice: DatiDellaCornice | null; cartella: string } => ({ cornice: structuredClone(marketing), cartella: 'UAT Q4' });

/** La visita di Inertia alla «Corta», col segnale con cui Inertia la annulla; `parametri` in più nell'indirizzo (`&lenta=6000`). */
const visita = (segnale?: AbortSignal, parametri = '') => ({ method: 'get' as const, url: `/layout.html?pagina=corta${parametri}`, signal: segnale });

/** La pagina che l'indirizzo dice, come la risponde la pagina di prova. */
const paginaDi = (indirizzo: URL) => ({ component: new URLSearchParams(indirizzo.search).get('pagina') ?? '', props: { errors: {}, cornice: marketing } });

/**
 * La parte server di una pagina di prova, nei suoi due tempi: `leggi` quando la visita arriva, e ciò che `leggi` dà,
 * `consegna`, quando la risposta è pronta.
 */
function parteServer() {
    const consegna = vi.fn(paginaDi);
    const leggi = vi.fn((indirizzo: URL) => () => consegna(indirizzo));

    return { leggi, consegna };
}

/** Solo l'attesa della risposta è finta: l'orologio dei segni resta quello vero. */
const tempoFinto = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('la parte server finta della pagina di prova del layout', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('ogni lettura porta in cornice un aggiornati_il nuovo: l\'istante della lettura, in UTC coi microsecondi, maggiore di quello di prima anche in tre letture di seguito (sprint 10 · T3.1)', () => {
        const segni = [1, 2, 3].map(() => lettura(props(), true).cornice?.aggiornati_il ?? '');

        for (const segno of segni) {
            expect(segno).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
            // Al millisecondo: i tre decimali in più `Date` non li legge.
            expect(Math.abs(Date.parse(`${segno.slice(0, 23)}Z`) - Date.now())).toBeLessThan(60_000);
        }
        expect(segni[1] > segni[0]).toBe(true);
        expect(segni[2] > segni[1]).toBe(true);
    });

    it('una lettura è una copia nuova, come una risposta: i dati che le si danno non cambiano, e il resto arriva com\'è (sprint 10 · T3.1)', () => {
        const dati = props();
        const letta = lettura(dati, true);

        expect(dati).toEqual(props());
        expect(letta.cornice).not.toBe(dati.cornice);
        expect(letta).toEqual({ cornice: { ...marketing, aggiornati_il: letta.cornice?.aggiornati_il }, cartella: 'UAT Q4' });
    });

    it('senza i dati della cornice la lettura non ha un segno da mettere: cornice resta null (sprint 10 · T3.1)', () => {
        expect(lettura({ cornice: null }, true)).toEqual({ cornice: null });
        expect(lettura({ cornice: null }, false)).toEqual({ cornice: null });
    });

    it('?segno=no toglie il segno, ed è il solo valore che lo toglie (sprint 10 · T3.2)', () => {
        expect(colSegno('?segno=no')).toBe(false);
        expect(colSegno('?pagina=lunga&segno=no&non_lette=0')).toBe(false);
        expect(colSegno('')).toBe(true);
        expect(colSegno('?pagina=corta')).toBe(true);
        expect(colSegno('?segno=si')).toBe(true);
    });

    it('senza segno due letture sono uguali in tutto, come le dava la parte server della v1.2.0; col segno no (sprint 10 · T3.2)', () => {
        const senza = [lettura(props(), false), lettura(props(), false)];

        expect(senza[0]).toEqual(senza[1]);
        expect(senza[0]).toEqual(props());
        expect(senza[0].cornice).not.toHaveProperty('aggiornati_il');
        expect(lettura(props(), true)).not.toEqual(lettura(props(), true));
    });

    it('a una visita risponde dopo un attimo come la parte server: 200, x-inertia e la pagina che l\'indirizzo dice (sprint 10 · T3.1)', async () => {
        const scritte = vi.spyOn(console, 'info').mockImplementation(() => {});
        const { leggi, consegna } = parteServer();

        // Col segnale di una visita che nessuno annulla.
        const risposta = await clientFinto(leggi, 1).request(visita(new AbortController().signal));

        expect(risposta.status).toBe(200);
        expect(risposta.headers).toEqual({ 'x-inertia': 'true' });
        expect(JSON.parse(risposta.data)).toEqual({ component: 'corta', props: { errors: {}, cornice: marketing }, url: '/layout.html?pagina=corta', version: null });
        expect(leggi).toHaveBeenCalledTimes(1);
        expect(consegna).toHaveBeenCalledTimes(1);
        expect(scritte).toHaveBeenCalledWith('UAT visita', 'get', '/layout.html?pagina=corta');
    });

    it('una visita che Inertia annulla mentre aspetta la risposta è rifiutata con HttpCancelledError, come fa il client vero, e la sua pagina non si prepara (sprint 10 · T3.1, review della PR)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const { leggi, consegna } = parteServer();
        const annulla = new AbortController();

        const risposta = clientFinto(leggi, 20).request(visita(annulla.signal));
        annulla.abort();

        await expect(risposta).rejects.toBeInstanceOf(HttpCancelledError);
        // Nemmeno dopo, quando la risposta sarebbe stata pronta.
        await new Promise((dopo) => setTimeout(dopo, 40));
        expect(consegna).not.toHaveBeenCalled();
    });

    // Il client vero ascolta l'annullo da quando la richiesta gli arriva (`signal.addEventListener('abort', …)`): un segnale già
    // annullato non lo avvisa, la richiesta parte e Inertia monta la sua risposta. Succede con due visite nello stesso giro, che
    // solo uno script fa (due clic di una persona stanno in due giri): la pagina di prova fa lo stesso, non di meglio.
    it('una visita già annullata quando arriva al client non è rifiutata, come nel client vero: la richiesta parte e la risposta arriva (sprint 10 · T3.1, seconda lettura della PR)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const { leggi, consegna } = parteServer();
        const annulla = new AbortController();
        annulla.abort();

        const risposta = await clientFinto(leggi, 1).request(visita(annulla.signal));

        expect(risposta.status).toBe(200);
        expect(JSON.parse(risposta.data).component).toBe('corta');
        expect(consegna).toHaveBeenCalledTimes(1);
    });

    it('la parte server legge quando la visita le arriva, non quando la risposta parte: i dati di una visita lenta portano il segno dell\'arrivo, più indietro di quello di una lettura fatta mentre la risposta aspetta (sprint 11 · T3.1)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const consegnate: string[] = [];
        // Come la pagina di prova: la lettura all'arrivo, e alla consegna solo ciò che si conta.
        const client = clientFinto((indirizzo) => {
            const letta = lettura(props(), true);

            return () => {
                consegnate.push(indirizzo.search);

                return { component: 'corta', props: { errors: {}, ...letta } };
            };
        }, 1);

        const lenta = client.request(visita(new AbortController().signal, '&lenta=30'));
        // Mentre la risposta aspetta, un'altra lettura: l'elenco delle notifiche, o una visita partita dopo.
        const nelFrattempo = lettura(props(), true).cornice?.aggiornati_il ?? '';
        expect(consegnate).toEqual([]);
        const consegnata = JSON.parse((await lenta).data) as { props: { cornice: DatiDellaCornice } };
        const dopo = lettura(props(), true).cornice?.aggiornati_il ?? '';

        expect(consegnate).toEqual(['?pagina=corta&lenta=30']);
        expect(consegnata.props.cornice.aggiornati_il).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
        expect((consegnata.props.cornice.aggiornati_il ?? '') < nelFrattempo).toBe(true);
        expect(nelFrattempo < dopo).toBe(true);
    });

    it('una visita con lenta=<ms> nell\'indirizzo è consegnata dopo quei millisecondi, non prima; le altre dopo l\'attesa del client (sprint 11 · T3.1)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        tempoFinto();
        const { leggi, consegna } = parteServer();
        const client = clientFinto(leggi, 50);
        const arrivate: string[] = [];
        const parte = (parametri: string) => void client.request(visita(new AbortController().signal, parametri)).then((risposta) => arrivate.push((JSON.parse(risposta.data) as { url: string }).url));

        parte('&lenta=6000');
        parte('');
        // Tutte e due sono già arrivate alla parte server, che ha letto; nessuna è ancora consegnata.
        expect(leggi).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(49);
        expect(consegna).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(arrivate).toEqual(['/layout.html?pagina=corta']);

        await vi.advanceTimersByTimeAsync(5949);
        expect(arrivate).toEqual(['/layout.html?pagina=corta']);
        expect(consegna).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(arrivate).toEqual(['/layout.html?pagina=corta', '/layout.html?pagina=corta&lenta=6000']);
        expect(consegna).toHaveBeenCalledTimes(2);
    });

    it('lenta vale solo se è un numero intero di millisecondi: con ogni altro valore la visita aspetta come le altre (sprint 11 · T3.1)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        tempoFinto();
        const { leggi, consegna } = parteServer();
        const client = clientFinto(leggi, 50);

        for (const parametri of ['&lenta=', '&lenta=presto', '&lenta=-6000', '&lenta=1e9', '&lenta=6000ms', '&lenta=60.5']) {
            void client.request(visita(new AbortController().signal, parametri));
        }
        await vi.advanceTimersByTimeAsync(49);
        expect(consegna).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(consegna).toHaveBeenCalledTimes(6);
    });

    it('una visita lenta annullata mentre aspetta è rifiutata come le altre: la parte server l\'aveva già letta, ma non la consegna, nemmeno quando i suoi millisecondi sono passati (sprint 11 · T3.1)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        tempoFinto();
        const { leggi, consegna } = parteServer();
        const annulla = new AbortController();

        const risposta = clientFinto(leggi, 50).request(visita(annulla.signal, '&lenta=6000'));
        const rifiutata = expect(risposta).rejects.toBeInstanceOf(HttpCancelledError);
        await vi.advanceTimersByTimeAsync(3000);
        annulla.abort();

        await rifiutata;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(leggi).toHaveBeenCalledTimes(1);
        expect(consegna).not.toHaveBeenCalled();
    });
});
