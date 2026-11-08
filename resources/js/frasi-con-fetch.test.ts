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
    // Voce #3511 · AC 7 (Decisione 23057). Fino alla `v4.28.0` partivano due richieste, il file della lingua e quello
    // dell'inglese, per le frasi che la lingua non aveva; dalla `v4.29.0` ogni lingua di zr-core ha tutte le frasi dell'inglese
    // (lo controlla `LingueTest.php`), e la cornice chiede solo il file della lingua.
    it.each([['it', /\/it\.json/], ['es', /\/es\.json/], ['es-MX', /\/es\.json/]])('per «%s» parte una sola richiesta, il file della lingua, all\'indirizzo della build e con un tempo massimo di dieci secondi: `en.json` non si chiede, nemmeno dopo (sprint 30 · T1.3, T1.4; voce #3511 · 7)', async (lingua, delFile) => {
        const attesa = vi.spyOn(AbortSignal, 'timeout');
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ 'notificationTitle.uat': 'UAT titolo' }));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte, indirizziDelleFrasi } = await import('./campanella');

        expect(fetchFinto).not.toHaveBeenCalled();
        expect(Object.keys(indirizziDelleFrasi).sort()).toStrictEqual([EN, '../lingue/notifiche/es.json', IT]);
        expect(indirizziDelleFrasi[IT]).toMatch(/\/it\.json(\?|$)/);

        await expect(caricaFrasi(lingua)).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT titolo' });
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        expect(fetchFinto.mock.calls[0]?.[0]).toMatch(delFile);
        expect(fetchFinto.mock.calls[0]?.[0]).not.toBe(indirizziDelleFrasi[EN]);
        expect(attesa.mock.calls).toStrictEqual([[10_000]]);
        expect(fetchFinto.mock.calls.map(([, opzioni]) => opzioni?.signal)).toStrictEqual(attesa.mock.results.map((esito) => esito.value));

        // In memoria: non si richiedono.
        expect(frasiPronte(lingua)).toStrictEqual({ 'notificationTitle.uat': 'UAT titolo' });
        await caricaFrasi(lingua);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each([[404], [500], [503]])('una risposta %i è un errore, anche se ha un corpo: niente resta in memoria, e la richiesta dopo riparte da capo e riesce (T1.5)', async (status) => {
        const fetchFinto = vi.fn(async (_indirizzo: string) => risposta({ 'notificationTitle.uat': 'UAT' }));
        fetchFinto.mockImplementationOnce(async () => risposta({ 'notificationTitle.uat': 'UAT pagina di errore' }, status));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./campanella');

        await expect(caricaFrasi('it')).rejects.toBeUndefined();
        expect(frasiPronte('it')).toBeUndefined();
        expect(fetchFinto).toHaveBeenCalledTimes(1);

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(fetchFinto).toHaveBeenCalledTimes(2);
    });

    // Sprint 33 · T3.1 (voce #1909). Un 200 che non porta le frasi — la pagina di un proxy, un file vuoto — è un errore come un
    // 404: le frasi sono un oggetto con almeno un testo sotto una chiave `notificationTitle…`.
    const ARRIVATE_MALE: [string, unknown][] = [
        ['`null`', null], ['un elenco', []], ['un oggetto vuoto', {}], ['un oggetto senza frasi', { data: {} }], ['un testo', 'UAT pagina di errore'], ['un numero', 7],
        ['un titolo vuoto', { 'notificationTitle.uat': '' }], ['un titolo che non è un testo', { 'notificationTitle.uat': { it: 'UAT' } }],
    ];

    it.each(ARRIVATE_MALE)('un 200 con %s al posto delle frasi della lingua è un errore e non resta in volo né in memoria: la richiesta dopo riparte da capo e riesce (sprint 30 · T1.5; sprint 33 · T3.1)', async (_caso, corpo) => {
        const fetchFinto = vi.fn(async (_indirizzo: string) => risposta({ 'notificationTitle.uat': 'UAT' }));
        fetchFinto.mockImplementationOnce(async () => risposta(corpo));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./campanella');

        await expect(caricaFrasi('it')).rejects.toBeUndefined();
        expect(frasiPronte('it')).toBeUndefined();
        expect(fetchFinto).toHaveBeenCalledTimes(1);

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(fetchFinto).toHaveBeenCalledTimes(2);
    });

    // Voce #3511 · AC 7: dalla `v4.29.0` l'inglese di chi ha un'altra lingua non si chiede, e un `en.json` che arriverebbe male non
    // conta. Per chi usa l'inglese, le frasi arrivate male sono quelle della sua lingua (sopra, con «en»).
    it.each(ARRIVATE_MALE)('un `en.json` che darebbe %s non conta per chi ha l\'italiano: non si chiede, e le frasi della lingua sono pronte (sprint 33 · T3.1; voce #3511 · 7)', async (_caso, corpo) => {
        const fetchFinto = vi.fn(async (indirizzo: string) => risposta(/\/en\.json/.test(indirizzo) ? corpo : { 'notificationTitle.uat': 'UAT' }));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./campanella');

        await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(frasiPronte('it')).toStrictEqual({ 'notificationTitle.uat': 'UAT' });
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each(ARRIVATE_MALE)('per chi usa l\'inglese un 200 con %s al posto di `en.json` è un errore, e niente resta in memoria (sprint 33 · T3.1; voce #3511 · 8)', async (_caso, corpo) => {
        const fetchFinto = vi.fn(async (_indirizzo: string) => risposta(corpo));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte } = await import('./campanella');

        await expect(caricaFrasi('en')).rejects.toBeUndefined();
        expect(frasiPronte('en')).toBeUndefined();
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each(['en', 'en-GB'])('chi usa l\'inglese («%s») fa una sola richiesta di `en.json` per volta, e in memoria restano le frasi (sprint 33 · T3.5)', async (lingua) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ 'notificationTitle.uat': 'UAT title' }));
        vi.stubGlobal('fetch', fetchFinto);
        const { caricaFrasi, frasiPronte, indirizziDelleFrasi } = await import('./campanella');

        await expect(caricaFrasi(lingua)).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT title' });
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual([indirizziDelleFrasi[EN]]);
        expect(frasiPronte(lingua)).toStrictEqual({ 'notificationTitle.uat': 'UAT title' });
    });

    it('dove il browser non ha `AbortSignal.timeout` le frasi si chiedono lo stesso, senza un tempo massimo: niente lancia e il pannello non resta in attesa (T1.5)', async () => {
        expect(AbortSignal.timeout).toBeTypeOf('function');
        // Una proprietà sua che copre quella vera: tolta, torna quella di prima.
        Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true });
        try {
            const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ 'notificationTitle.uat': 'UAT' }));
            vi.stubGlobal('fetch', fetchFinto);
            const { caricaFrasi } = await import('./campanella');

            await expect(caricaFrasi('it')).resolves.toStrictEqual({ 'notificationTitle.uat': 'UAT' });
            expect(fetchFinto.mock.calls.map(([, opzioni]) => opzioni?.signal)).toStrictEqual([undefined]);
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
        const { caricaFrasi, frasiPronte } = await import('./campanella');

        const chiesta = caricaFrasi('es');
        expect(orologi).toHaveLength(1);
        orologi.forEach((orologio) => orologio.abort());

        await expect(chiesta).rejects.toThrow('The operation timed out.');
        expect(frasiPronte('es')).toBeUndefined();

        void caricaFrasi('es').catch(() => undefined);
        expect(fetchFinto).toHaveBeenCalledTimes(2);
    });
});

describe('`frasiInMemoria`, per i test di chi installa il pacchetto (sprint 30 · T1)', () => {
    it('mette in memoria le frasi di ogni lingua coi file del pacchetto, senza chiamare il `fetch` che c\'è, e lo lascia com\'era', async () => {
        const fetchFinto = vi.fn(async () => risposta({}, 500));
        vi.stubGlobal('fetch', fetchFinto);
        const { frasiInMemoria } = await import('./prove');
        const { caricaFrasi, frasiPronte } = await import('./campanella');
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

    // Sprint 33 · T1.6 (voce #1915). Dalla `v2.0.0` ciò che compone le righe è un pezzo a richiesta: `frasiInMemoria` dà alla
    // cornice anche quello, così la riga di prima nel file di preparazione dei test basta ancora.
    it('dà alla cornice anche il pezzo della campanella: dopo, la cornice ha pezzo e frasi senza chiedere niente (sprint 33 · T1.6)', async () => {
        const fetchFinto = vi.fn(async () => risposta({}, 500));
        vi.stubGlobal('fetch', fetchFinto);
        const { frasiInMemoria } = await import('./prove');
        const delleLingue = await import('./lingue');
        expect(delleLingue.campanella).toBeUndefined();

        await frasiInMemoria();

        expect(delleLingue.campanella).toBe(await import('./campanella'));
        expect(delleLingue.campanella?.frasiPronte('it')).toStrictEqual({ ...frasiInglesi, ...frasiItaliane });
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    // Sprint 42 · T3 (voce #2054). Dalla `v2.8.0` anche la ricerca è un pezzo a richiesta: `frasiInMemoria` dà alla cornice anche
    // quello, così in un test di chi installa la ricerca parte 300 ms dopo l'ultimo tasto, come prima, senza un giro in più.
    it('dà alla cornice anche il pezzo della ricerca: dopo, la cornice lo ha senza chiederlo (sprint 42 · T3)', async () => {
        const { frasiInMemoria } = await import('./prove');
        const deiServizi = await import('./servizi');
        expect(deiServizi.ricerca).toBeUndefined();

        await frasiInMemoria();

        expect(deiServizi.ricerca).toBe(await import('./ricerca'));
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

// Sprint 31 · T4 (voce #1908; review della PR #63, R18 e S8). Le frasi vere dal caricatore vero, e `frasiInMemoria` che non
// risponde al posto di altri.
describe('le frasi dei file del pacchetto, dal caricatore vero (sprint 31 · T4)', () => {
    const FILE: Record<string, unknown> = { it: frasiItaliane, es: frasiSpagnole, en: frasiInglesi };
    /** Serve i file del pacchetto col nome che l'indirizzo dice: come la cornice abbina un file a una lingua non lo sa. */
    const serveIFile = () => vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => {
        const [, nome = ''] = /\/(\w+)\.json(?:\?|$)/.exec(indirizzo) ?? [];

        return nome in FILE ? risposta(FILE[nome]) : risposta({}, 404);
    });

    it.each([
        ['it', frasiItaliane],
        ['es', frasiSpagnole],
        ['en', frasiInglesi],
        ['zz', frasiInglesi],
    ])('con la lingua "%s" le frasi che carica la cornice sono quelle dei file del pacchetto: il file della lingua sopra quello dell\'inglese (T4.1)', async (lingua, file) => {
        const fetchDiProva = serveIFile();
        vi.stubGlobal('fetch', fetchDiProva);
        const { caricaFrasi, frasiPronte } = await import('./campanella');
        expect(frasiPronte(lingua)).toBeUndefined();

        await expect(caricaFrasi(lingua)).resolves.toStrictEqual({ ...frasiInglesi, ...file });
        expect(fetchDiProva).toHaveBeenCalled();
        expect(frasiPronte(lingua)).toStrictEqual({ ...frasiInglesi, ...file });
    });

    it('mentre `frasiInMemoria` carica, una richiesta a un indirizzo che non è di un file delle frasi passa al `fetch` di prima, con le sue opzioni (T4.3)', async () => {
        const delModulo = risposta({ data: [] });
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => delModulo);
        vi.stubGlobal('fetch', fetchFinto);
        const { frasiInMemoria } = await import('./prove');
        const opzioni = { headers: { Accept: 'application/json' } };

        const inMemoria = frasiInMemoria();
        expect(globalThis.fetch).not.toBe(fetchFinto);
        const altra = globalThis.fetch('/cornice/notifiche', opzioni);
        await inMemoria;

        expect(await altra).toBe(delModulo);
        expect(fetchFinto.mock.calls).toStrictEqual([['/cornice/notifiche', opzioni]]);
        expect(globalThis.fetch).toBe(fetchFinto);
    });

    it('chi rifà i moduli richiama `frasiInMemoria` presa con un import nuovo: quella importata prima mette le frasi nel modulo di prima (T4.4)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({}, 500)));
        const { frasiInMemoria: diPrima } = await import('./prove');
        vi.resetModules();
        const { frasiPronte } = await import('./campanella');

        await diPrima();
        expect(frasiPronte('it')).toBeUndefined();

        const { frasiInMemoria } = await import('./prove');
        await frasiInMemoria();
        expect(frasiPronte('it')).toStrictEqual({ ...frasiInglesi, ...frasiItaliane });
    });
});
