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

    // Sprint 22 · T3 (voce #1716; seconda lettura della PR #31, S1). La pagina dà alla cornice gli stessi dati finché non
    // cambiano: qui lo dice il numero sulla campanella, letto dal DOM dopo che la pagina si è ridisegnata. Contare le scritte
    // di demo.tsx non basta: con `useMemo` e una dipendenza che cambia a ogni disegno le scritte sono le stesse, e il numero torna.
    it('dopo «Segna tutte come lette» un clic che naviga ridisegna la pagina e non rimette il numero sulla campanella (sprint 22 · T3.2)', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            const numero = () => uno('.zr-bell-count')?.textContent ?? null;
            // Le rotte finte rispondono dopo 800 ms.
            const risponde = () => act(async () => {
                await vi.advanceTimersByTimeAsync(800);
            });
            await apri('');

            expect(numero()).toBe('7');
            await clic(uno('.zr-bell'));
            await risponde();
            await clic(uno('.zr-notif .zr-pop-head button'));
            await risponde();
            expect(numero()).toBeNull();
            // Un clic che naviga: la prima notifica, «Nuova scheda», dallo sprint 24 (T3) apre la sua scheda, cioè la pagina di
            // prova scrive l'indirizzo e si ridisegna. È già letta, e il clic non chiede altro.
            await clic(uno('.zr-notif-list .zr-notif-item'));
            expect(scritti()).toStrictEqual([['https://board.zeiras.com/w/uat-marketing/c/uat-scheda-1']]);
            expect(numero()).toBeNull();
        } finally {
            vi.useRealTimers();
        }
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

    // Sprint 24 · T2 (voce #1745): chi non ha accettato i documenti legali in vigore. Con `?accettazione=1` la pagina dà alla
    // cornice i dati ridotti, come la parte server; con `?accettazione=dopo` i dati sono quelli di sempre, e lo dicono le rotte finte.
    const moduli = () => [...(document.querySelector('#pagina .zr-nav .zr-nav-group')?.querySelectorAll('a.zr-nav-item .zr-nav-label') ?? [])].map((voce) => voce.textContent);

    it.each([['?accettazione=1'], ['?accettazione=1&prodotto=pm']])('con «%s» la cornice è ridotta: solo la Dashboard nel menu Moduli, nessun numero sulla campanella, l\'avviso sopra il contenuto della pagina, che resta, e un clic sul pulsante scrive in console la pagina dell\'accettazione (sprint 24 · T2.1, T2.3)', async (query) => {
        await apri(query);

        expect(moduli()).toStrictEqual(['Dashboard']);
        expect([uno('.zr-product-switch'), uno('.zr-bell-count')]).toStrictEqual([null, null]);
        expect(uno('main .zr-alert strong')?.textContent).toBe('Ci sono documenti da accettare');
        expect(uno('main #uat-scelte')).not.toBeNull();
        await clic(uno('main .zr-alert button'));
        expect(scritti()).toStrictEqual([[`https://app.zeiras.com/legale/accetta?ritorno=${encodeURIComponent(`https://uat.example.com/${query}`)}`]]);
    });

    it('con «?accettazione=dopo» la pagina è quella di sempre finché una rotta non risponde: aperta la campanella la cornice passa allo stato ridotto, e il pannello ha la frase, non l\'errore di caricamento (sprint 24 · T2.5)', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            await apri('?accettazione=dopo&prodotto=pm');
            expect([uno('.zr-product-switch') !== null, uno('.zr-bell-count')?.textContent, uno('main .zr-alert')]).toStrictEqual([true, '7', null]);

            await clic(uno('.zr-bell'));
            // Le rotte finte rispondono dopo 800 ms.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(800);
            });
            expect(moduli()).toStrictEqual(['Dashboard']);
            expect([uno('.zr-product-switch'), uno('.zr-bell-count')]).toStrictEqual([null, null]);
            expect(uno('main .zr-alert strong')?.textContent).toBe('Ci sono documenti da accettare');
            expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe('Non disponibile finché non accetti i documenti.');
            expect(uno('main #uat-scelte')).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
