import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import frasiInglesi from '../lingue/notifiche/en.json';
import frasiItaliane from '../lingue/notifiche/it.json';
import frasiSpagnole from '../lingue/notifiche/es.json';

// Sprint 30 · T1 (voce #1875). La cornice chiede i file delle frasi delle notifiche con `fetch`, quando si apre la campanella:
// qui le richieste vere, con un `fetch` finto. In un file suo, perché ogni caso riparte dal modulo delle lingue appena
// caricato, senza le frasi che il file di preparazione mette in memoria.

const IT = '../lingue/notifiche/it.json';
const EN = '../lingue/notifiche/en.json';
const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('le frasi delle notifiche si chiedono con `fetch` (sprint 30 · T1)', () => {
    it('per una lingua partono due richieste, il suo file e quello dell\'inglese, agli indirizzi della build e con un tempo massimo di dieci secondi (T1.3, T1.4)', async () => {
        const attesa = vi.spyOn(AbortSignal, 'timeout');
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => risposta(/\/it\.json/.test(indirizzo) ? { 'notificationTitle.uat': 'UAT titolo' } : { 'notificationTitle.uat': 'UAT title', 'notificationTitle.solo': 'UAT only' }));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte, indirizziDelleFrasi } = await import('./lingue');

        expect(fetchFinto).not.toHaveBeenCalled();
        expect(Object.keys(indirizziDelleFrasi).sort()).toStrictEqual([EN, '../lingue/notifiche/es.json', IT]);
        expect(indirizziDelleFrasi[IT]).toMatch(/\/it\.json(\?|$)/);

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT titolo', 'notificationTitle.solo': 'UAT only' });
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo).sort()).toStrictEqual([indirizziDelleFrasi[EN], indirizziDelleFrasi[IT]].sort());
        expect(attesa.mock.calls).toStrictEqual([[10_000], [10_000]]);
        expect(fetchFinto.mock.calls.map(([, opzioni]) => opzioni?.signal)).toStrictEqual(attesa.mock.results.map((esito) => esito.value));

        // In memoria: non si richiedono.
        expect(frasiPronte('it')).toStrictEqual({ 'notificationTitle.uat': 'UAT titolo', 'notificationTitle.solo': 'UAT only' });
        await caricaFrasi('it');
        expect(fetchFinto).toHaveBeenCalledTimes(2);
    });

    it.each([[404], [500], [503]])('una risposta %i è un errore, anche se ha un corpo: niente resta in memoria, e la richiesta dopo riparte da capo e riesce (T1.5)', async (status) => {
        const fetchFinto = vi.fn(async (_indirizzo: string) => risposta({ 'notificationTitle.uat': 'UAT' }));
        fetchFinto.mockImplementationOnce(async () => risposta({ 'notificationTitle.uat': 'UAT pagina di errore' }, status));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./lingue');

        await expect(caricaFrasi('it')).rejects.toBeUndefined();
        expect(frasiPronte('it')).toBeUndefined();
        expect(fetchFinto).toHaveBeenCalledTimes(2);

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(fetchFinto).toHaveBeenCalledTimes(4);
    });

    it('un 200 col corpo `null` è un errore e non resta in volo: la richiesta dopo riparte da capo e riesce (T1.5)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string) => risposta({ 'notificationTitle.uat': 'UAT' }));
        fetchFinto.mockImplementationOnce(async () => risposta(null)).mockImplementationOnce(async () => risposta(null));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./lingue');

        await expect(caricaFrasi('it')).rejects.toBeInstanceOf(TypeError);
        expect(frasiPronte('it')).toBeUndefined();
        expect(fetchFinto).toHaveBeenCalledTimes(2);

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(fetchFinto).toHaveBeenCalledTimes(4);
    });

    it('dove il browser non ha `AbortSignal.timeout` le frasi si chiedono lo stesso, senza un tempo massimo: niente lancia e il pannello non resta in attesa (T1.5)', async () => {
        expect(AbortSignal.timeout).toBeTypeOf('function');
        // Una proprietà sua che copre quella vera: tolta, torna quella di prima.
        Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true });
        try {
            const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ 'notificationTitle.uat': 'UAT' }));
            vi.stubGlobal('fetch', fetchFinto);
            const { caricaFrasi } = await import('./lingue');

            await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
            expect(fetchFinto.mock.calls.map(([, opzioni]) => opzioni?.signal)).toStrictEqual([undefined, undefined]);
        } finally {
            Reflect.deleteProperty(AbortSignal, 'timeout');
        }
    });

    it('una richiesta che non risponde entro il tempo massimo è un errore come un altro: la promessa è respinta e «Riprova» può richiedere (T1.5)', async () => {
        const orologi: AbortController[] = [];
        vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
            const orologio = new AbortController();
            orologi.push(orologio);

            return orologio.signal;
        });
        // Una rete che non risponde mai: finisce solo se chi ha chiesto smette di aspettare.
        const fetchFinto = vi.fn((_indirizzo: string, opzioni?: RequestInit) => new Promise<Response>((_fatto, respinta) => {
            opzioni?.signal?.addEventListener('abort', () => respinta(new DOMException('The operation timed out.', 'TimeoutError')));
        }));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./lingue');

        const chiesta = caricaFrasi('es');
        expect(orologi).toHaveLength(2);
        orologi.forEach((orologio) => orologio.abort());

        await expect(chiesta).rejects.toThrow('The operation timed out.');
        expect(frasiPronte('es')).toBeUndefined();

        void caricaFrasi('es').catch(() => undefined);
        expect(fetchFinto).toHaveBeenCalledTimes(4);
    });
});

describe('`frasiInMemoria`, per i test di chi installa il pacchetto (sprint 30 · T1)', () => {
    it('mette in memoria le frasi di ogni lingua coi file del pacchetto, senza chiamare il `fetch` che c\'è, e lo lascia com\'era', async () => {
        const fetchFinto = vi.fn(async () => risposta({}, 500));
        vi.stubGlobal('fetch', fetchFinto);
        const { frasiInMemoria } = await import('./prove');
        const { caricaFrasi, frasiPronte } = await import('./lingue');
        expect(frasiPronte('it')).toBeUndefined();

        await frasiInMemoria();

        expect(globalThis.fetch).toBe(fetchFinto);
        expect(frasiPronte('it')).toStrictEqual({ ...frasiInglesi, ...frasiItaliane });
        expect(frasiPronte('es')).toStrictEqual({ ...frasiInglesi, ...frasiSpagnole });
        expect(frasiPronte('en')).toStrictEqual(frasiInglesi);
        // Una lingua che zr-core non ha, e una variante di una che ha.
        expect(frasiPronte('zz')).toStrictEqual(frasiInglesi);
        expect(frasiPronte('es-MX')).toStrictEqual({ ...frasiInglesi, ...frasiSpagnole });

        await caricaFrasi('it');
        await caricaFrasi('zz');
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    it('se le frasi non si caricano rimette lo stesso il `fetch` di prima', async () => {
        const fetchFinto = vi.fn(async () => risposta({}));
        vi.stubGlobal('fetch', fetchFinto);
        vi.spyOn(Response, 'json').mockImplementation(() => risposta({}, 500));
        const { frasiInMemoria } = await import('./prove');

        await expect(frasiInMemoria()).rejects.toBeUndefined();
        expect(globalThis.fetch).toBe(fetchFinto);
    });
});
