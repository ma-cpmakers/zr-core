import { afterEach, describe, expect, it, vi } from 'vitest';

// Sprint 55 · T3 (voce #2063). Col JS della cornice servito con una coda (`?v=3`) da un JS che non monta la pagina, il pezzo
// della ricerca importa dall'ingresso un'altra copia di `servizi`: lì a schermo non c'è nessuno, e un 429 è un'istanza di
// un'altra `TroppeRichieste`. Dalla `v2.16.0` la cornice passa al pezzo `chiama` e chi è a schermo, e il freno si riconosce
// dai `secondi`. Qui la copia del pezzo è quella che vitest dà: la persona a schermo, nel suo `servizi`, non c'è mai.

afterEach(() => {
    vi.restoreAllMocks();
});

const risposta = { data: [], workspace: 'principale' };

describe('il pezzo della ricerca con la `chiama` e chi è a schermo della cornice (T3.2, T3.4)', () => {
    it('cerca con la `chiama` che riceve, anche se nel suo `servizi` a schermo non c\'è nessuno', async () => {
        const { cercaPer } = await import('./ricerca');
        const chiama = vi.fn(() => Promise.resolve(risposta));
        const mostra = vi.fn();
        const questa = new AbortController();

        await cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, { current: 0 }, mostra, () => undefined, () => undefined, 'anna@esempio.it', chiama);

        expect(chiama).toHaveBeenCalledWith('/cornice/ricerca', 'anna@esempio.it', 'POST', { q: 'ua' }, { signal: questa.signal });
        expect(mostra).toHaveBeenCalledWith({ stato: 'ready', risultati: [], workspace: 'principale' });
    });

    it('non cerca per chi non è più a schermo quando il pezzo arriva', async () => {
        const { cercaPer } = await import('./ricerca');
        const chiama = vi.fn(() => Promise.resolve(risposta));
        const questa = new AbortController();

        expect(cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, { current: 0 }, () => undefined, () => undefined, () => undefined, 'bruno@esempio.it', chiama)).toBeUndefined();
        expect(cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, { current: 0 }, () => undefined, () => undefined, () => undefined, undefined, chiama)).toBeUndefined();
        expect(chiama).not.toHaveBeenCalled();
    });
});

describe('un 429 da un\'altra copia del modulo (T3.3)', () => {
    it('ferma la ricerca per i suoi secondi, al più 60, anche se non è un\'istanza di `TroppeRichieste`', async () => {
        const { cercaPer } = await import('./ricerca');
        vi.spyOn(performance, 'now').mockReturnValue(1_000);
        const nelFreno = vi.fn();
        const mostra = vi.fn();
        const frenataFinoA = { current: 0 };
        const questa = new AbortController();
        const daUnAltraCopia = Object.assign(new Error('429 troppe_richieste'), { secondi: 30 });

        await cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, frenataFinoA, mostra, () => undefined, nelFreno, 'anna@esempio.it', () => Promise.reject(daUnAltraCopia));

        expect(nelFreno).toHaveBeenCalledTimes(1);
        expect(frenataFinoA.current).toBe(31_000);
        expect(mostra).not.toHaveBeenCalled();

        await cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, frenataFinoA, mostra, () => undefined, nelFreno, 'anna@esempio.it', () => Promise.reject(Object.assign(new Error('429'), { secondi: 3600 })));

        expect(frenataFinoA.current).toBe(61_000);
    });

    it('un errore senza secondi non frena: è l\'errore', async () => {
        const { cercaPer } = await import('./ricerca');
        const nelFreno = vi.fn();
        const mostra = vi.fn();
        const questa = new AbortController();

        await cercaPer('ua', questa, 'anna@esempio.it', { current: questa }, { current: 0 }, mostra, () => undefined, nelFreno, 'anna@esempio.it', () => Promise.reject(new Error('500')));

        expect(nelFreno).not.toHaveBeenCalled();
        expect(mostra).toHaveBeenCalledWith({ stato: 'error' });
    });
});
