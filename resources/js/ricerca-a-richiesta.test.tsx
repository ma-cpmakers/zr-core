import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cornice } from './cornice';
import type { DatiDellaCornice } from './index';
import { testi } from './lingue';
// @ts-expect-error il pezzo e chi lo chiede arrivano col commit dopo: questo è il commit coi soli casi rossi
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
    // @ts-expect-error il pezzo e chi lo chiede arrivano col commit dopo: questo è il commit coi soli casi rossi
    const chiesto = vi.spyOn(deiServizi, 'chiediLaRicerca').mockImplementation(async () => {
        if (arrivato === undefined) {
            await new Promise<void>((lascia) => inAttesa.push(lascia));
        }
        arrivato = dellaRicerca;

        return dellaRicerca;
    });
    // @ts-expect-error il pezzo e chi lo chiede arrivano col commit dopo: questo è il commit coi soli casi rossi
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

describe('prima dell\'arrivo del pezzo la cornice non è più quella che ha cercato (T2.4)', () => {
    it.each<[caso: string, dopo: DatiDellaCornice]>([
        ['passa allo stato ridotto di chi deve accettare i documenti', { ...dati, prodotti: [], aziende: [], non_lette: 0, accettazione_richiesta: true }],
        ['passa allo stato ridotto di quando i dati non si sono potuti leggere', { ...dati, prodotti: [], aziende: [], non_lette: 0, non_letti: true }],
        ['è di un\'altra persona', { ...dati, persona: { nome: 'Grace Hopper', email: 'grace@example.com' } }],
    ])('la cornice %s: all\'arrivo non parte nessuna richiesta, né per chi c\'era prima né per chi c\'è, e sotto il campo non resta «Sto cercando…»', async (_caso, dopo) => {
        const pezzo = pezzoInRitardo();
        await mostra(dati);
        await scrivi('ada');
        expect(inCaricamento()).toBe(testi('it').searchLoading);

        await mostra(dopo);
        await pezzo.arriva();
        await passano(1_000);

        expect(cercate()).toStrictEqual([]);
        expect(inCaricamento()).toBeNull();
        expect(titoli()).toStrictEqual([]);
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
