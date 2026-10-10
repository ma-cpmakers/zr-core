import { HttpCancelledError } from '@inertiajs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatiDellaCornice } from '../js/cornice';
import { clientFinto, colSegno, lettura } from './parte-server-finta';

// Sprint 10 · T3 (voce #1453), dopo la review della PR. La UAT del layout gira sulla pagina di prova, e ciò che lì fa la parte
// server lo fa questo file: se smette di mettere il segno a ogni lettura, se `?segno=no` non lo toglie più, o se risponde a una
// visita che Inertia ha annullato, la pagina di prova mostra un comportamento che il prodotto non ha, e le righe della UAT non
// distinguono più. La pagina di prova lo usa così com'è: lo lega tests/Feature/PacchettoTest.php.

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

/** La visita di Inertia alla «Corta», col segnale con cui Inertia la annulla. */
const visita = (segnale?: AbortSignal) => ({ method: 'get' as const, url: '/layout.html?pagina=corta', signal: segnale });

/** La pagina che l'indirizzo dice, come la risponde la pagina di prova. */
const paginaDi = (indirizzo: URL) => ({ component: new URLSearchParams(indirizzo.search).get('pagina') ?? '', props: { errors: {}, cornice: marketing } });

describe('la parte server finta della pagina di prova del layout', () => {
    afterEach(() => {
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
        const pagina = vi.fn(paginaDi);

        // Col segnale di una visita che nessuno annulla.
        const risposta = await clientFinto(pagina, 1).request(visita(new AbortController().signal));

        expect(risposta.status).toBe(200);
        expect(risposta.headers).toEqual({ 'x-inertia': 'true' });
        expect(JSON.parse(risposta.data)).toEqual({ component: 'corta', props: { errors: {}, cornice: marketing }, url: '/layout.html?pagina=corta', version: null });
        expect(pagina).toHaveBeenCalledTimes(1);
        expect(scritte).toHaveBeenCalledWith('UAT visita', 'get', '/layout.html?pagina=corta');
    });

    it('una visita che Inertia annulla mentre aspetta la risposta è rifiutata con HttpCancelledError, come fa il client vero, e la sua pagina non si prepara (sprint 10 · T3.1, review della PR)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const pagina = vi.fn(paginaDi);
        const annulla = new AbortController();

        const risposta = clientFinto(pagina, 20).request(visita(annulla.signal));
        annulla.abort();

        await expect(risposta).rejects.toBeInstanceOf(HttpCancelledError);
        // Nemmeno dopo, quando la risposta sarebbe stata pronta.
        await new Promise((dopo) => setTimeout(dopo, 40));
        expect(pagina).not.toHaveBeenCalled();
    });

    // Il client vero ascolta l'annullo da quando la richiesta gli arriva (`signal.addEventListener('abort', …)`): un segnale già
    // annullato non lo avvisa, la richiesta parte e Inertia monta la sua risposta. Succede con due visite nello stesso giro, che
    // solo uno script fa (due clic di una persona stanno in due giri): la pagina di prova fa lo stesso, non di meglio.
    it('una visita già annullata quando arriva al client non è rifiutata, come nel client vero: la richiesta parte e la risposta arriva (sprint 10 · T3.1, seconda lettura della PR)', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const pagina = vi.fn(paginaDi);
        const annulla = new AbortController();
        annulla.abort();

        const risposta = await clientFinto(pagina, 1).request(visita(annulla.signal));

        expect(risposta.status).toBe(200);
        expect(JSON.parse(risposta.data).component).toBe('corta');
        expect(pagina).toHaveBeenCalledTimes(1);
    });
});
