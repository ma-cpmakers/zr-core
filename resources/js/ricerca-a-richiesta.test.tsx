import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cornice } from './cornice';
import type { DatiDellaCornice } from './index';
import { testi } from './lingue';
import * as dellaRicerca from './ricerca';
import * as deiServizi from './servizi';

// Sprint 42 · T2 (voce #2054). Dalla `v2.8.0` la ricerca della cornice è un pezzo a richiesta (`./ricerca`): la cornice lo chiede
// al primo fuoco nel campo della ricerca, o alla prima parola, mai al montaggio. Qui il pezzo è quello vero, ma al posto di chi
// lo chiede c'è il caso, che dice quando arriva: una parola scritta prima dell'arrivo aspetta, e all'arrivo parte una richiesta
// sola, se chi l'ha scritta è ancora a schermo e la cornice non è ridotta. In un file suo: negli altri il pezzo è arrivato
// prima di ogni caso. Che il codice della ricerca non stia nel JS d'ingresso lo prova `peso.test.ts`.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo' },
};
const trovata = { tipo: 'board.board', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Lancio Q4' };

let contenitore: HTMLDivElement;
let radice: Root;
let fetchFinto: ReturnType<typeof vi.fn<(indirizzo: string, opzioni?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // I 300 ms che l'`AppShell` aspetta dopo l'ultimo tasto, e i secondi di ritardo del pezzo, passano quando lo dice il caso.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ data: [trovata], workspace: 'acme-marketing', persona: 'ada@example.com' }) }) as Response);
    vi.stubGlobal('fetch', fetchFinto);
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const laCornice = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={() => {}}><p>La pagina</p></Cornice>;
const mostra = async (deiDati: DatiDellaCornice) => act(async () => radice.render(laCornice(deiDati)));
const passano = async (millisecondi: number) => act(async () => { await vi.advanceTimersByTimeAsync(millisecondi); });
const campo = () => contenitore.querySelector<HTMLInputElement>('.zr-search input') as HTMLInputElement;
/** Le richieste della ricerca partite: la parola nel corpo e la persona per cui sono chieste, com'è nell'intestazione. */
const cercate = () => fetchFinto.mock.calls.filter(([indirizzo]) => indirizzo === '/cornice/ricerca').map(([, opzioni]) => [opzioni?.method, opzioni?.body, new Headers(opzioni?.headers).get('Persona')]);
const inCaricamento = () => contenitore.querySelector('.zr-search-panel [role="status"] .zr-visually-hidden')?.textContent ?? null;
const titoli = () => [...contenitore.querySelectorAll('.zr-search-panel [role="option"] .zr-search-title')].map((titolo) => titolo.textContent);

/** Scrive nel campo della ricerca, col fuoco nel campo come una persona o senza, e lascia passare i 300 ms dell'`AppShell`. */
async function scrivi(parola: string, colFuoco = true): Promise<void> {
    await act(async () => {
        if (colFuoco) {
            campo().focus();
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo(), parola);
        campo().dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);
    });
}

/** Il pezzo della ricerca, che arriva quando il caso lo dice: fino ad allora chi lo chiede aspetta, e la cornice non lo ha. */
function pezzoInRitardo() {
    let arrivato: typeof dellaRicerca | undefined;
    const inAttesa: (() => void)[] = [];
    const chiesto = vi.spyOn(deiServizi, 'chiediLaRicerca').mockImplementation(async () => {
        if (arrivato === undefined) {
            await new Promise<void>((lascia) => inAttesa.push(lascia));
        }
        arrivato = dellaRicerca;

        return dellaRicerca;
    });
    vi.spyOn(deiServizi, 'ricerca', 'get').mockImplementation(() => arrivato);

    return {
        chiesto,
        arriva: async () => act(async () => {
            inAttesa.splice(0).forEach((lascia) => lascia());
            await vi.advanceTimersByTimeAsync(0);
        }),
    };
}

describe('quando si chiede il pezzo della ricerca (T2.1)', () => {
    it('al montaggio la cornice non lo chiede, nemmeno dopo dieci secondi; lo chiede il primo fuoco nel campo della ricerca, prima di ogni parola', async () => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);
        await passano(10_000);
        expect(pezzo.chiesto).not.toHaveBeenCalled();

        await act(async () => campo().focus());

        expect(pezzo.chiesto).toHaveBeenCalledTimes(1);
        expect(cercate()).toStrictEqual([]);
    });

    it('se il fuoco nel campo non c\'è stato lo chiede la prima parola', async () => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);

        await scrivi('ada', false);

        expect(pezzo.chiesto).toHaveBeenCalledTimes(1);
    });
});

describe('una parola scritta prima che il pezzo sia arrivato (T2.2)', () => {
    it.each<[caso: string, poi: string | undefined, parte: string]>([
        ['«ada»', undefined, 'ada'],
        ['«ada», e poi una lettera in più, «adal»', 'adal', 'adal'],
    ])('col pezzo in ritardo di tre secondi, scritto %s: sotto il campo «Sto cercando…» subito e nessuna richiesta; all\'arrivo parte una richiesta sola, con ciò che è nel campo, senza altri tasti, e i risultati sono i suoi', async (_caso, poi, parte) => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);

        await scrivi('ada');
        expect(inCaricamento()).toBe(testi('it').searchLoading);
        if (poi !== undefined) {
            await passano(700);
            await scrivi(poi);
        }
        await passano(3_000);
        expect(inCaricamento()).toBe(testi('it').searchLoading);
        expect(cercate()).toStrictEqual([]);

        await pezzo.arriva();

        expect(cercate()).toStrictEqual([['POST', JSON.stringify({ q: parte }), 'ada%40example.com']]);
        expect(campo().value).toBe(parte);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
        expect(inCaricamento()).toBeNull();
        // Nemmeno dopo: i 300 ms dell'`AppShell` sono passati da un pezzo, e nessuna richiesta era rimasta indietro.
        await passano(1_000);
        expect(cercate()).toHaveLength(1);
    });
});

describe('una lettera battuta meno di 300 ms prima dell\'arrivo del pezzo (T2.2)', () => {
    // L'`AppShell` dà la parola alla cornice 300 ms dopo l'ultimo tasto: all'arrivo del pezzo parte l'ultima parola che ha dato,
    // e la lettera battuta in quei 300 ms parte al loro scadere, come ogni parola scritta mentre una ricerca è in volo: la
    // richiesta di prima è annullata e i risultati sono quelli di ciò che è nel campo.
    it('all\'arrivo parte la parola che la cornice aveva, e 200 ms dopo quella che è nel campo, che annulla la prima: i risultati sono i suoi', async () => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);
        await scrivi('ada');
        await passano(2_600);
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo(), 'adal');
            campo().dispatchEvent(new Event('input', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(cercate()).toStrictEqual([]);

        await pezzo.arriva();
        expect(cercate().map(([, corpo]) => corpo)).toStrictEqual([JSON.stringify({ q: 'ada' })]);

        await passano(200);
        expect(cercate().map(([, corpo]) => corpo)).toStrictEqual([JSON.stringify({ q: 'ada' }), JSON.stringify({ q: 'adal' })]);
        expect(fetchFinto.mock.calls.filter(([indirizzo]) => indirizzo === '/cornice/ricerca').map(([, opzioni]) => opzioni?.signal?.aborted)).toStrictEqual([true, false]);

        await passano(1_000);
        expect(cercate()).toHaveLength(2);
        expect(campo().value).toBe('adal');
        expect(titoli()).toStrictEqual(['Lancio Q4']);
        expect(inCaricamento()).toBeNull();
    });
});

describe('prima dell\'arrivo del pezzo la cornice non è più quella che ha cercato (T2.4)', () => {
    // L'altra persona entra col segno della lettura da tutte e due le parti: senza, la pagina si ricarica e a schermo non resta
    // niente (dalla `v2.8.0`), e il caso non direbbe niente della ricerca. Per questo in fondo si guarda di chi è la cornice.
    it.each<[caso: string, dopo: DatiDellaCornice, mostrata: string]>([
        ['passa allo stato ridotto di chi deve accettare i documenti', { ...dati, prodotti: [], aziende: [], non_lette: 0, accettazione_richiesta: true }, 'Ada Lovelace'],
        ['passa allo stato ridotto di quando i dati non si sono potuti leggere', { ...dati, prodotti: [], aziende: [], non_lette: 0, non_letti: true }, 'Ada Lovelace'],
        ['è di un\'altra persona', { ...dati, persona: { nome: 'Grace Hopper', email: 'grace@example.com' }, aggiornati_il: '2026-10-13T08:00:03.000000Z' }, 'Grace Hopper'],
    ])('la cornice %s: all\'arrivo non parte nessuna richiesta, né per chi c\'era prima né per chi c\'è, e sotto il campo non resta «Sto cercando…»', async (_caso, dopo, mostrata) => {
        const pezzo = pezzoInRitardo();
        await mostra({ ...dati, aggiornati_il: '2026-10-13T08:00:00.000000Z' });
        await scrivi('ada');
        expect(inCaricamento()).toBe(testi('it').searchLoading);

        await mostra(dopo);
        await pezzo.arriva();
        await passano(1_000);

        expect(cercate()).toStrictEqual([]);
        expect(inCaricamento()).toBeNull();
        expect(titoli()).toStrictEqual([]);
        expect(contenitore.querySelector('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(mostrata);
    });

    // Il controllo vede ciò che cerca: con la stessa persona e altri dati di sempre, dopo gli stessi tasti, all'arrivo la ricerca parte.
    it('con altri dati di sempre della stessa persona, all\'arrivo la richiesta parte', async () => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);
        await scrivi('ada');

        await mostra({ ...dati, non_lette: 3 });
        await pezzo.arriva();

        expect(cercate()).toStrictEqual([['POST', JSON.stringify({ q: 'ada' }), 'ada%40example.com']]);
    });
});

// Sprint 47 · T2 (voce #2055). La cornice smontata col pezzo in viaggio: il layout la rifà quando cambia il workspace, con la
// stessa persona, e la cornice nuova non è quella che ha cercato. All'arrivo la parola scritta nella cornice di prima non parte.
describe('prima dell\'arrivo del pezzo la cornice è smontata (T2)', () => {
    const rifatta = (chiave: string, deiDati: DatiDellaCornice) => act(async () => radice.render(<Cornice key={chiave} dati={deiDati} product="pm" onLogout={() => {}}><p>La pagina</p></Cornice>));
    const inUnAltro: DatiDellaCornice = { ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' } };

    it.each<[caso: string, dopo: DatiDellaCornice]>([
        ['in un altro workspace', inUnAltro],
        ['nello stesso workspace (una cornice nuova con gli stessi dati)', dati],
    ])('e rifatta con la stessa persona %s: all\'arrivo nessuna richiesta parte (T2.1); una parola scritta dopo cerca come sempre (T2.2)', async (_caso, dopo) => {
        const pezzo = pezzoInRitardo();
        await rifatta('prima', dati);
        await scrivi('ada');
        expect(inCaricamento()).toBe(testi('it').searchLoading);

        await rifatta('dopo', dopo);
        await pezzo.arriva();
        await passano(1_000);

        expect(cercate()).toStrictEqual([]);

        await scrivi('lancio');
        await passano(0);

        expect(cercate()).toStrictEqual([['POST', JSON.stringify({ q: 'lancio' }), 'ada%40example.com']]);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
    });

    // Qui la difendono due strati: l'annullo nella pulizia della cornice e `cercaPer`, che non cerca per chi non è più a schermo.
    // Tolto uno solo dei due il caso resta verde; tolto l'annullo, sono rossi i due casi di sopra (la stessa persona rifatta).
    it('e non rifatta: all\'arrivo nessuna richiesta parte, e niente va in console (T2.3)', async () => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);
        await scrivi('ada');

        await act(async () => radice.render(<p>Un'altra pagina</p>));
        await pezzo.arriva();
        await passano(1_000);

        expect(cercate()).toStrictEqual([]);
    });
});

// Sprint 42 · T3 (voce #2054). Il pezzo che non arriva: una rete caduta, un file che una build nuova ha tolto.
const avviso = () => contenitore.querySelector('.zr-search-panel [role="alert"]')?.textContent ?? null;
const sottoIlCampo = () => contenitore.querySelector('.zr-search-panel')?.textContent ?? '';

/** Il pezzo della ricerca che non arriva le prime `volte` che è chiesto (chi lo chiede è respinto con `errore`), e dopo arriva. */
function pezzoCheNonArriva(volte: number, errore: () => unknown = () => new TypeError('Failed to fetch dynamically imported module')) {
    let arrivato: typeof dellaRicerca | undefined;
    let respinte = 0;
    const chiesto = vi.spyOn(deiServizi, 'chiediLaRicerca').mockImplementation(async () => {
        if (arrivato === undefined && respinte < volte) {
            respinte++;
            throw errore();
        }
        arrivato = dellaRicerca;

        return dellaRicerca;
    });
    vi.spyOn(deiServizi, 'ricerca', 'get').mockImplementation(() => arrivato);

    return chiesto;
}

describe('il pezzo della ricerca non arriva (T3.1)', () => {
    // Un fallimento del pezzo non è una risposta della rotta: qualunque cosa porti, non accende il freno del 429 e non manda
    // la cornice nello stato ridotto di chi deve accettare i documenti.
    it.each<[caso: string, errore: () => unknown]>([
        ['la rete è caduta', () => new TypeError('Failed to fetch dynamically imported module')],
        ['chi lo chiede è respinto con un `TroppeRichieste` da 60 secondi', () => new deiServizi.TroppeRichieste('429', 60)],
        ['chi lo chiede è respinto con un `AccettazioneRichiesta`', () => new deiServizi.AccettazioneRichiesta('403')],
    ])('%s: sotto il campo l\'avviso con l\'errore della ricerca, non «Sto cercando…» né «Nessun risultato», e nessuna richiesta; la parola dopo richiede il pezzo e, arrivato, parte', async (_caso, errore) => {
        const chiesto = pezzoCheNonArriva(1, errore);
        await mostra(dati);

        await scrivi('ada', false);

        expect(chiesto).toHaveBeenCalledTimes(1);
        expect(avviso()).toBe(testi('it').searchError);
        expect(inCaricamento()).toBeNull();
        expect(sottoIlCampo()).not.toContain(testi('it').searchEmpty);
        expect(cercate()).toStrictEqual([]);
        // Nemmeno dopo: non è un caricamento che non finisce, e niente parte da solo.
        await passano(10_000);
        expect(avviso()).toBe(testi('it').searchError);
        expect(chiesto).toHaveBeenCalledTimes(1);

        await scrivi('adal', false);

        expect(chiesto).toHaveBeenCalledTimes(2);
        expect(cercate()).toStrictEqual([['POST', JSON.stringify({ q: 'adal' }), 'ada%40example.com']]);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
        expect(avviso()).toBeNull();
    });
});

describe('dopo il pezzo che non è arrivato si riprova scrivendo (T3.2)', () => {
    it('ogni parola richiede il pezzo, anche la stessa riscritta, e a ogni fallimento torna l\'avviso; il fuoco che lo ha chiesto per primo non mostra niente; all\'arrivo si cerca ciò che è nel campo', async () => {
        const chiesto = pezzoCheNonArriva(3);
        await mostra(dati);

        await act(async () => campo().focus());
        expect(chiesto).toHaveBeenCalledTimes(1);
        expect(avviso()).toBeNull();

        await scrivi('ada');
        expect(chiesto).toHaveBeenCalledTimes(2);
        expect(avviso()).toBe(testi('it').searchError);

        // Cancellata fino a una lettera: sotto i due caratteri l'`AppShell` non cerca, e il pezzo non è chiesto.
        await scrivi('a');
        expect(chiesto).toHaveBeenCalledTimes(2);
        expect(avviso()).toBeNull();

        await scrivi('ada');
        expect(chiesto).toHaveBeenCalledTimes(3);
        expect(avviso()).toBe(testi('it').searchError);
        expect(cercate()).toStrictEqual([]);

        await scrivi('adal');
        expect(chiesto).toHaveBeenCalledTimes(4);
        expect(cercate()).toStrictEqual([['POST', JSON.stringify({ q: 'adal' }), 'ada%40example.com']]);
        expect(campo().value).toBe('adal');
        expect(titoli()).toStrictEqual(['Lancio Q4']);
        expect(avviso()).toBeNull();
        expect(inCaricamento()).toBeNull();
    });
});
