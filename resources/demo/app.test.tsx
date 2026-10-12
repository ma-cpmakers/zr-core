import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 25 · T2 (voce #1759). app.html: la pagina di prova con la cornice presa dall'ingresso per le app (app.tsx). La cornice è
// quella di index.html, e da quell'ingresso nessuno scrive `window.Zeiras` né `window.React`: la pagina lo dice sotto le scelte.
// Da index.tsx, con l'ingresso di sempre, ci sono tutti e due.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('la pagina di prova dell\'ingresso per le app (T2.3)', () => {
    const fetchDiPrima = window.fetch;
    const globali = window as unknown as Record<string, unknown>;

    /** La pagina di prova montata da quell'ingresso, in un DOM vuoto e senza i globali di un caricamento di prima. */
    async function monta(ingresso: 'app' | 'index'): Promise<void> {
        vi.resetModules();
        delete globali.Zeiras;
        delete globali.React;
        document.body.innerHTML = '<div id="pagina"></div>';
        await act(async () => {
            await (ingresso === 'app' ? import('./app') : import('./index'));
        });
    }

    /** Ciò che la pagina mostra, senza la riga che solo app.tsx scrive. */
    function mostrato(): string {
        const pagina = document.querySelector('#pagina')?.cloneNode(true) as HTMLElement;
        pagina.querySelector('#uat-zeiras')?.remove();

        return pagina.innerHTML;
    }

    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'error');
    });

    afterEach(() => {
        const errori = vi.mocked(console.error).mock.calls.slice();
        vi.restoreAllMocks();
        // Le rotte finte della pagina prendono il posto di `fetch`.
        window.fetch = fetchDiPrima;
        document.body.innerHTML = '';
        expect(errori).toStrictEqual([]);
    });

    it('monta la cornice, non scrive window.Zeiras né window.React, e lo dice sotto le scelte', async () => {
        await monta('app');

        expect(document.querySelector('#pagina .zr-shell')).not.toBeNull();
        expect('Zeiras' in window).toBe(false);
        expect('React' in window).toBe(false);
        expect(document.querySelector('#uat-zeiras')?.textContent).toBe('window.Zeiras: assente');
    });

    it('dall\'ingresso di sempre i due globali sono scritti, e la pagina non scrive quella riga', async () => {
        await monta('index');

        expect(document.querySelector('#pagina .zr-shell')).not.toBeNull();
        expect('Zeiras' in window).toBe(true);
        expect('React' in window).toBe(true);
        expect(document.querySelector('#uat-zeiras')).toBeNull();
    });

    it('la cornice è la stessa da un ingresso e dall\'altro: tolta quella riga, la pagina mostra le stesse cose', async () => {
        await monta('index');
        const diSempre = mostrato();
        await monta('app');

        expect(diSempre).toContain('zr-shell');
        expect(mostrato()).toBe(diSempre);
    });
});
