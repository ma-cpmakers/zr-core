import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import italiani from '../lingue/avvisi/it.json';
import { Cornice } from './cornice';

// v3.8.1 (R5 della revisione 381): il pezzo dei testi degli avvisi che non arriva — la rete, o un rilascio che ha tolto i file
// coi nomi di prima mentre la scheda resta aperta — si richiede, con l'attesa degli altri pezzi a richiesta, finché la cornice è
// ridotta e la scheda è in primo piano (zr-pm, 26/10/2026): l'avviso
// dell'accettazione, col suo pulsante, arriva lo stesso. In un file suo: un modulo si carica una volta per file.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chiesto = vi.hoisted(() => ({ volte: 0 }));
vi.mock('./avvisi', async (originale) => {
    if (++chiesto.volte === 1) {
        throw new TypeError('Failed to fetch dynamically imported module');
    }

    return originale();
});

it('il pezzo degli avvisi che la prima volta non arriva si richiede dopo l\'attesa, non con la scheda in secondo piano, e l\'avviso dell\'accettazione c\'è (v3.8.1, R5 della revisione 381)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }) as Response));
    const contenitore = document.body.appendChild(document.createElement('div'));
    const radice = createRoot(contenitore);
    const sopraLaPagina = () => contenitore.querySelector('main .zr-alert')?.textContent ?? null;
    const dati = { lingua: 'it', persona: { nome: 'Ada Lovelace', email: 'ada@example.com' }, workspace: { nome: 'Marketing', slug: 'acme-marketing' }, prodotti: {}, aziende: [], non_lette: 0, accettazione_richiesta: true };

    await act(async () => radice.render(<Cornice dati={dati} product="pm" onLogout={() => {}}><p>La pagina</p></Cornice>));
    await act(() => vi.dynamicImportSettled());
    expect([chiesto.volte, sopraLaPagina()]).toStrictEqual([1, null]);

    // Con la scheda in secondo piano non si richiede.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
        await vi.advanceTimersByTimeAsync(120e3);
        await vi.dynamicImportSettled();
    });
    expect([chiesto.volte, sopraLaPagina()]).toStrictEqual([1, null]);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    for (let giri = 0; giri < 100 && sopraLaPagina() === null; giri++) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1e3);
            await vi.dynamicImportSettled();
        });
    }

    expect(chiesto.volte).toBe(2);
    expect(sopraLaPagina()).toBe(italiani.acceptanceTitle + italiani.acceptanceText + italiani.acceptanceAction);
    await act(async () => radice.unmount());
    vi.useRealTimers();
});
