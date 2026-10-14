import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testi } from './lingue';

// Sprint 42 · T3 (voce #2054, T3.2). Chi chiede il pezzo della ricerca (`chiediLaRicerca`, in `servizi.ts`) quando il pezzo non
// arriva: la promessa è respinta e niente resta, e la richiesta dopo lo richiede. In un file suo: qui `./ricerca` la prima
// volta non si carica, e negli altri file il pezzo è quello vero dal primo caso. Che la seconda richiesta parta davvero in
// Chromium, che di un modulo fallito ricorda l'indirizzo, lo provano `lingue.test.ts` (`pezzoARichiesta`) e la UAT.

// Il caso riparte dai moduli appena caricati: il file di preparazione (`frasiInMemoria`) ha già dato il pezzo a quelli di prima.
// Dalla `v2.11.5` (sprint 50 · T5) dopo un pezzo non arrivato la richiesta dopo aspetta: qui l'orologio della pagina fa un
// minuto e un secondo a ogni lettura, e ogni richiesta arriva quando l'attesa è finita; il caso dell'attesa ha il suo.
beforeEach(() => {
    vi.resetModules();
    let adesso = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (adesso += 61_000));
});

afterEach(() => {
    vi.doUnmock('./ricerca');
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('chi chiede il pezzo della ricerca, quando il pezzo non arriva (T3.2)', () => {
    it('è respinto e niente resta; la richiesta dopo lo richiede, e arrivato il pezzo resta', async () => {
        let caricamenti = 0;
        const pezzo = { cercaPer: () => undefined, risultatiDellaRicerca: () => [] };
        vi.doMock('./ricerca', () => {
            if (caricamenti++ === 0) {
                throw new TypeError('Failed to fetch dynamically imported module');
            }

            return pezzo;
        });
        const servizi = await import('./servizi');

        await expect(servizi.chiediLaRicerca()).rejects.toThrow();
        expect(caricamenti).toBe(1);
        expect(servizi.ricerca).toBeUndefined();

        const arrivata = await servizi.chiediLaRicerca();

        expect(caricamenti).toBe(2);
        expect(arrivata.cercaPer).toBe(pezzo.cercaPer);
        expect(servizi.ricerca).toBe(arrivata);
        expect(await servizi.chiediLaRicerca()).toBe(arrivata);
        expect(caricamenti).toBe(2);
    });
});

// Sprint 50 · T5 (voce #2056): nell'attesa dopo un pezzo non arrivato un fuoco o una parola nella ricerca non lo richiedono, e
// sotto il campo c'è l'avviso di quando il pezzo non arriva, non «Sto cercando…». Qui la cornice vera, col pezzo vero.
describe('nell\'attesa dopo un pezzo della ricerca non arrivato (sprint 50 · T5.3, T5.5)', () => {
    it('la parola scritta non richiede il pezzo e sotto il campo c\'è l\'avviso; passato il secondo la parola dopo lo richiede, e arrivato si cerca', async () => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const ora = { adesso: 0 };
        vi.spyOn(performance, 'now').mockImplementation(() => ora.adesso);
        let caricamenti = 0;
        vi.doMock('./ricerca', async (originale) => {
            if (caricamenti++ === 0) {
                throw new TypeError('Failed to fetch dynamically imported module');
            }

            return originale();
        });
        const trovata = { tipo: 'board.board', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Lancio Q4' };
        const fetchFinto = vi.fn(async (_indirizzo: string) => ({ ok: true, status: 200, json: async () => ({ data: [trovata], workspace: 'acme-marketing', persona: 'ada@example.com' }) }) as Response);
        vi.stubGlobal('fetch', fetchFinto);
        const { Cornice } = await import('./cornice');
        const contenitore = document.createElement('div');
        document.body.append(contenitore);
        const radice = createRoot(contenitore);
        const campo = () => contenitore.querySelector<HTMLInputElement>('.zr-search input') as HTMLInputElement;
        const avviso = () => contenitore.querySelector('.zr-search-panel [role="alert"]')?.textContent ?? null;
        const inCaricamento = () => contenitore.querySelector('.zr-search-panel [role="status"] .zr-visually-hidden')?.textContent ?? null;
        const cercate = () => fetchFinto.mock.calls.filter(([indirizzo]) => indirizzo === '/cornice/ricerca').length;
        const scrivi = async (parola: string) => act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo(), parola);
            campo().dispatchEvent(new Event('input', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(300);
        });
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            await act(async () => radice.render(createElement(Cornice, { dati: { lingua: 'it', persona: { nome: 'Ada Lovelace', email: 'ada@example.com' }, workspace: { nome: 'Marketing', slug: 'acme-marketing' }, prodotti: { pm: 'attivo' } }, product: 'pm', onLogout: () => {} })));
            await act(async () => {
                campo().focus();
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(caricamenti).toBe(1);

            ora.adesso = 999;
            await scrivi('ada');
            expect(caricamenti).toBe(1);
            expect(avviso()).toBe(testi('it').searchError);
            expect(inCaricamento()).toBeNull();
            expect(cercate()).toBe(0);

            ora.adesso = 1_000;
            await scrivi('adal');
            // Il pezzo vero arriva da un `import()`, che finisce fuori dall'orologio finto.
            await act(async () => {
                await vi.waitFor(() => expect(cercate()).toBe(1));
            });
            expect(caricamenti).toBe(2);
            expect(cercate()).toBe(1);
            expect(avviso()).toBeNull();
        } finally {
            vi.useRealTimers();
            await act(async () => radice.unmount());
            contenitore.remove();
        }
    });
});

// Sprint 50 · T6 (review, R4): «Riprova» chiede il pezzo della campanella senza l'attesa, fino a `pezzoARichiesta`. Il caso della
// cornice (`cornice.test.tsx`, T5.5) guarda che cosa passa a `chiediLaCampanella`; qui `chiediLaCampanella` vera, col pezzo che
// non arriva: in un file coi moduli rifatti a ogni caso, come la ricerca qui sopra.
describe('chi chiede il pezzo della campanella, nell\'attesa dopo un pezzo non arrivato (sprint 50 · T5.5)', () => {
    it('senza `senzaAttesa` non lo richiede ed è respinto; con `senzaAttesa`, come «Riprova», lo richiede', async () => {
        const ora = { adesso: 0 };
        vi.spyOn(performance, 'now').mockImplementation(() => ora.adesso);
        let caricamenti = 0;
        vi.doMock('./campanella', () => {
            caricamenti++;
            throw new TypeError('Failed to fetch dynamically imported module');
        });
        const lingue = await import('./lingue');

        await expect(lingue.chiediLaCampanella()).rejects.toThrow();
        expect(caricamenti).toBe(1);

        ora.adesso = 500;
        await expect(lingue.chiediLaCampanella()).rejects.toThrow();
        expect(caricamenti).toBe(1);

        await expect(lingue.chiediLaCampanella(true)).rejects.toThrow();
        expect(caricamenti).toBe(2);
        vi.doUnmock('./campanella');
    });
});
