import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 19 · T1 (voce #1669). La pagina di prova della `Cornice` com'è, caricata nel DOM finto con la sua query: sulle aziende
// che `?aziende=` sceglie, «Nuovo workspace» c'è solo dove la persona può creare un workspace nell'azienda del workspace dei dati,
// e un clic scrive in console l'indirizzo che la cornice aprirebbe. È ciò che le righe della UAT guardano in un browser: se i
// dati d'esempio non distinguessero chi può da chi è solo membro, quelle righe non proverebbero niente.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('la pagina di prova della Cornice e «Nuovo workspace»', () => {
    const fetchDiPrima = window.fetch;
    /** Le aziende di default coi loro workspace, come il selettore aperto le mostra. */
    const dueAziende = [
        ['UAT Acme', ['UAT Vendite', 'UAT Marketing']],
        ['UAT Beta Consulenze', ['UAT Ricerca e sviluppo dei nuovi prodotti internazionali']],
    ];

    beforeEach(() => {
        // La pagina legge la query e monta la cornice quando il modulo si carica: un modulo nuovo a ogni test.
        vi.resetModules();
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'error');
        document.body.innerHTML = '<div id="pagina"></div>';
    });

    afterEach(() => {
        // Prima si rimette tutto com'era, poi si guarda: se un caso ha scritto un errore, quelli dopo non devono partire col
        // `fetch` finto e con le spie di questo (sprint 19 · review, R10).
        const errori = vi.mocked(console.error).mock.calls.slice();
        vi.restoreAllMocks();
        // Le rotte finte della pagina prendono il posto di `fetch`.
        window.fetch = fetchDiPrima;
        document.body.innerHTML = '';
        expect(errori).toStrictEqual([]);
    });

    /** La pagina di prova caricata con quella query. */
    async function apri(query: string): Promise<void> {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        await act(async () => {
            await import('./demo');
        });
    }

    function uno(selettore: string): HTMLElement | null {
        return document.querySelector<HTMLElement>(`#pagina ${selettore}`);
    }

    async function clic(elemento: Element | null): Promise<void> {
        expect(elemento).not.toBeNull();
        await act(async () => (elemento as HTMLElement).click());
    }

    /** Il selettore aperto: ogni azienda coi suoi workspace, nell'ordine in cui stanno. */
    function nelSelettore(): (string | string[])[][] {
        return [...document.querySelectorAll('#pagina .zr-ws-menu .zr-ws-group')].map((gruppo) => [
            gruppo.querySelector('.zr-ws-group-title')?.textContent ?? '',
            [...gruppo.querySelectorAll('.zr-ws-item .zr-nav-label')].map((voce) => voce.textContent ?? ''),
        ]);
    }

    /** Gli indirizzi che la pagina ha scritto in console al posto di aprirli. */
    function scritti(): unknown[][] {
        return vi.mocked(console.info).mock.calls.filter(([che]) => che === 'UAT naviga').map(([, ...indirizzo]) => indirizzo);
    }

    it.each([[''], ['?aziende=due'], ['?prodotto=pm'], ['?lingua=en&prodotto=crm']])('con «%s» il selettore ha «Nuovo workspace» in fondo, e un clic scrive in console la pagina di zr-home nel workspace dei dati (sprint 19 · T1.6)', async (query) => {
        await apri(query);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe('UAT Acme');
        await clic(uno('.zr-ws-switch'));
        expect(nelSelettore()).toStrictEqual(dueAziende);
        expect(uno('.zr-ws-menu')?.lastElementChild?.className).toBe('zr-ws-item zr-ws-new');
        await clic(uno('.zr-ws-new'));
        expect(scritti()).toStrictEqual([['https://app.zeiras.com/w/uat-marketing/nuovo-workspace']]);
    });

    it('con «?aziende=membro» le aziende sono quelle di default e la persona è solo membro: «Nuovo workspace» non c\'è (sprint 19 · T1.6)', async () => {
        await apri('?aziende=membro');

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe('UAT Acme');
        await clic(uno('.zr-ws-switch'));
        expect(nelSelettore()).toStrictEqual(dueAziende);
        expect(uno('.zr-ws-menu')?.lastElementChild?.className).toBe('zr-ws-group');
        expect(uno('.zr-ws-new')).toBeNull();
    });

    it.each([['?aziende=nessuna'], ['?aziende=senza-corrente']])('con «%s» il workspace resta testo, e «Nuovo workspace» non c\'è (sprint 19 · T1.6)', async (query) => {
        await apri(query);

        expect(uno('.zr-workspace')?.textContent).toBe('UAT Marketing');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-ws-new')).toBeNull();
    });
});
