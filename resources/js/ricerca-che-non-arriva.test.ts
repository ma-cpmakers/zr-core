import { afterEach, describe, expect, it, vi } from 'vitest';

// Sprint 42 · T3 (voce #2054, T3.2). Chi chiede il pezzo della ricerca (`chiediLaRicerca`, in `servizi.ts`) quando il pezzo non
// arriva: la promessa è respinta e niente resta, e la richiesta dopo lo richiede. In un file suo: qui `./ricerca` la prima
// volta non si carica, e negli altri file il pezzo è quello vero dal primo caso. Che la seconda richiesta parta davvero in
// Chromium, che di un modulo fallito ricorda l'indirizzo, lo provano `lingue.test.ts` (`pezzoARichiesta`) e la UAT.

afterEach(() => {
    vi.doUnmock('./ricerca');
    vi.resetModules();
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
