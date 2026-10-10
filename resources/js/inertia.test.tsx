import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatiDellaCornice } from './index';

// Sprint 10 · T2 (voce #1453). La cornice sotto Inertia vera, la versione dei frontend, in un DOM finto: le visite passano da
// `router.visit` e da un client HTTP finto che risponde come la parte server. È lì che Inertia, in una visita alla stessa
// pagina, ridà alla pagina l'oggetto di prima per i dati uguali in profondità: senza un segno la cornice non li riconosce
// nuovi, e la campanella resta al numero che aveva. Col segno `aggiornati_il` di `Cornice::dati()`, diverso a ogni lettura,
// vale il numero dei dati. Ogni scenario ha qui accanto lo stesso giro senza il segno, coi dati come li dava la `v1.2.0`: lì
// la campanella resta com'era. Se Inertia cambia e uno di quei casi diventa rosso, il segno non serve più.
//
// Inertia inizializza il suo router una volta per modulo: ogni test riparte da moduli nuovi (`vi.resetModules()`, con Inertia
// fra i moduli che vitest tratta da sé: `server.deps.inline` in vitest.config.ts) e li importa dopo, in modo dinamico.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** L'indirizzo della pagina: ogni visita torna qui, allo stesso componente. */
const indirizzo = '/w/uat-marketing/oggi';
const esciSenzaEffetto = () => {};
/** Le notifiche come le dà GET /cornice/notifiche, dalla più recente: una non letta. */
const notificheDelServer = [
    { id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm' },
    { id: 'uat-n40', creata_il: '2026-10-05T12:00:00Z', letta: true, app: null },
];

/**
 * I dati di una lettura, come li dà `Cornice::dati()`: uguali in tutto a quelli delle altre letture con lo stesso numero di
 * non lette, tranne il segno, che è l'istante della lettura. `colSegno` `false` li dà come la `v1.2.0`, senza.
 */
function lettura(numero: number, nonLette: number, colSegno: boolean): DatiDellaCornice {
    return {
        lingua: 'it',
        persona: { nome: 'UAT Ada Lovelace', email: 'uat-ada@example.com' },
        workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
        prodotti: { pm: 'attivo', crm: 'disponibile' },
        aziende: [{ id: 'uat-az', nome: 'UAT Acme', workspace: [{ nome: 'UAT Marketing', slug: 'uat-marketing' }] }],
        non_lette: nonLette,
        ...(colSegno ? { aggiornati_il: `2026-10-09T21:31:0${numero}.123456Z` } : {}),
    };
}

/** La pagina di Inertia che la parte server risponde: sempre lo stesso componente, coi dati di quella lettura. */
function pagina(cornice: DatiDellaCornice) {
    return { component: 'Pagina', url: indirizzo, props: { errors: {}, cornice }, version: null, flash: {}, rescuedProps: [], rememberedState: {} };
}

/** Una risposta di una rotta della cornice, come `fetch` la dà: lo stato e il corpo JSON. */
function risposta(corpo: unknown, stato = 200): Response {
    return { ok: stato >= 200 && stato < 300, status: stato, json: async () => corpo } as Response;
}

let contenitore: HTMLDivElement;
let radice: Root | undefined;
/** `act` del React di questo test: i moduli sono nuovi a ogni test. */
let act: (typeof import('react'))['act'];

beforeEach(() => {
    contenitore = document.createElement('div');
    contenitore.id = 'app';
    document.body.append(contenitore);
    vi.spyOn(console, 'error');
    // I 300 ms che l'`AppShell` aspetta dopo l'ultimo tasto passano quando lo dice il test.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Le rotte della cornice: le notifiche qui sopra, «Segna tutte come lette» che riesce, e nessun risultato della ricerca.
    vi.stubGlobal(
        'fetch',
        vi.fn(async (rotta: string, opzioni?: RequestInit) => {
            if (rotta === '/cornice/notifiche') {
                return risposta({ data: notificheDelServer });
            }
            if (rotta === '/cornice/notifiche/letture') {
                return risposta({ data: { fino_a: new Date(String((JSON.parse(String(opzioni?.body)) as { fino_a?: unknown }).fino_a)).toISOString() } });
            }

            return risposta({ data: [] });
        }),
    );
});

afterEach(async () => {
    await act(async () => radice?.unmount());
    radice = undefined;
    contenitore.remove();
    // Prima la pulizia, poi il controllo: un test che scrive in console non lascia i suoi finti a quelli dopo.
    const errori = [...vi.mocked(console.error).mock.calls];
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // Nessun errore in console, nemmeno un avviso di React.
    expect(errori).toStrictEqual([]);
});

/** Il giro dopo, coi timer finti: le risposte già pronte arrivano. */
const giro = () => vi.advanceTimersByTimeAsync(0);

/**
 * L'app di un frontend con Inertia, sulla pagina della prima lettura: `conLayout` la mette sotto `LayoutDellaCornice`, dato a
 * `createInertiaApp`; senza, la pagina monta `Cornice` da sé, come i frontend prima del layout. La parte server è una coda: la
 * prima lettura è la pagina con cui l'app si apre, e ogni visita prende la successiva.
 */
async function avvia({ conLayout, letture }: { conLayout: boolean; letture: DatiDellaCornice[] }) {
    vi.resetModules();
    const { createInertiaApp, http, router } = await import('@inertiajs/react');
    const react = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { Cornice, LayoutDellaCornice } = await import('./index');
    act = react.act;

    const [prima, ...coda] = letture;
    /** Le visite arrivate alla parte server: il metodo e l'indirizzo. */
    const visiteArrivate: string[] = [];
    http.setClient({
        request: async (richiesta) => {
            visiteArrivate.push(`${richiesta.method} ${richiesta.url}`);
            const cornice = coda.shift();
            if (cornice === undefined) {
                throw new Error('UAT: la parte server non ha un\'altra lettura');
            }

            return { status: 200, data: JSON.stringify(pagina(cornice)), headers: { 'x-inertia': 'true' } };
        },
    });

    function Layout({ cornice, children }: { cornice?: DatiDellaCornice | null; children?: ReactNode }) {
        return (
            <LayoutDellaCornice cornice={cornice} onLogout={esciSenzaEffetto}>
                {children}
            </LayoutDellaCornice>
        );
    }

    function Pagina({ cornice }: { cornice: DatiDellaCornice }) {
        const contenuto = <p id="uat-pagina">UAT pagina</p>;

        return conLayout ? (
            contenuto
        ) : (
            <Cornice dati={cornice} onLogout={esciSenzaEffetto}>
                {contenuto}
            </Cornice>
        );
    }

    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com${indirizzo}`);
    await act(async () => {
        await createInertiaApp({
            page: pagina(prima),
            resolve: () => Pagina,
            layout: conLayout ? () => Layout : undefined,
            // Come nei frontend con la CSP del README: la barra di avanzamento metterebbe un `<style>` nella pagina.
            progress: false,
            setup: ({ el, App, props }) => {
                radice = createRoot(el as HTMLElement);
                radice.render(react.createElement(App, props));
            },
        });
        await giro();
    });

    return {
        visiteArrivate,
        /** Una visita vera di Inertia alla stessa pagina: finisce quando Inertia ha dato alla pagina i dati della risposta. */
        async visita(opzioni: { preserveState?: boolean } = {}): Promise<void> {
            let finita = false;
            await act(async () => {
                router.visit(indirizzo, { ...opzioni, onFinish: () => (finita = true) });
                for (let giri = 0; giri < 50 && !finita; giri += 1) {
                    await giro();
                }
                await giro();
            });
            expect(finita).toBe(true);
        },
    };
}

function uno(selettore: string): HTMLElement | null {
    return contenitore.querySelector<HTMLElement>(selettore);
}

function tutti(selettore: string): HTMLElement[] {
    return [...contenitore.querySelectorAll<HTMLElement>(selettore)];
}

/** Un clic, e una richiesta partita dal clic con la risposta già pronta arriva prima del controllo. */
async function clic(elemento: Element | null): Promise<void> {
    expect(elemento).not.toBeNull();
    await act(async () => {
        (elemento as HTMLElement).click();
        await giro();
    });
}

/** Scrive una parola nel campo della ricerca, come una persona, e lascia passare i 300 ms dopo cui l'`AppShell` cerca. */
async function scrivi(parola: string): Promise<void> {
    const campo = uno('.zr-search input') as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, parola);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);
        await giro();
    });
}

/** Il numero sulla campanella, o `null` se non ne ha uno. */
const numero = () => uno('.zr-bell-count')?.textContent ?? null;
const segnaTutte = () => uno('.zr-notif .zr-pop-head button');
const notificheNelPannello = () => tutti('.zr-notif .zr-notif-list .zr-notif-item');
/** Le richieste partite alle rotte della cornice, nell'ordine: il metodo e l'indirizzo. */
const richieste = () => vi.mocked(fetch).mock.calls.map(([rotta, opzioni]) => `${opzioni?.method ?? 'GET'} ${String(rotta)}`);

describe('la cornice sotto Inertia vera', () => {
    it('sotto il layout, dopo «Segna tutte come lette» la visita dopo porta lo stesso numero di prima del clic con un segno nuovo, e la campanella lo mostra (sprint 10 · T2.1); la cornice resta montata: stessi nodi, il testo della ricerca, il pannello aperto, senza un\'altra GET /cornice/notifiche (sprint 10 · T2.3)', async () => {
        const app = await avvia({ conLayout: true, letture: [lettura(1, 3, true), lettura(2, 3, true)] });
        expect(numero()).toBe('3');
        await scrivi('uat');
        await clic(uno('.zr-bell'));
        expect(notificheNelPannello()).toHaveLength(2);
        await clic(segnaTutte());
        expect(numero()).toBeNull();
        const barra = uno('aside.zr-side');
        const topbar = uno('header.zr-top');
        expect(barra).not.toBeNull();
        expect(topbar).not.toBeNull();
        expect(richieste()).toStrictEqual(['GET /cornice/ricerca?q=uat', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);

        await app.visita();
        expect(app.visiteArrivate).toStrictEqual([`get https://uat.example.com${indirizzo}`]);
        // Il conteggio del backoffice è quello di prima del clic (ne sono arrivate altre): è il numero dei dati nuovi, e si vede.
        expect(numero()).toBe('3');
        expect(uno('aside.zr-side')).toBe(barra);
        expect(uno('header.zr-top')).toBe(topbar);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('uat');
        expect(notificheNelPannello()).toHaveLength(2);
        expect(richieste()).toStrictEqual(['GET /cornice/ricerca?q=uat', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
    });

    it('senza il segno, coi dati della v1.2.0, dopo «Segna tutte come lette» la visita dopo con lo stesso numero lascia la campanella senza numero: Inertia ridà l\'oggetto di prima (il difetto; sprint 10 · T2.1)', async () => {
        const app = await avvia({ conLayout: true, letture: [lettura(1, 3, false), lettura(2, 3, false)] });
        expect(numero()).toBe('3');
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(numero()).toBeNull();

        await app.visita();
        expect(app.visiteArrivate).toHaveLength(1);
        expect(numero()).toBeNull();
    });

    it('sotto il layout, con zero non lette nei dati e una caricata dal pannello la campanella dice 1; la visita dopo porta di nuovo zero con un segno nuovo, e la campanella non ha più un numero (sprint 10 · T2.2)', async () => {
        const app = await avvia({ conLayout: true, letture: [lettura(1, 0, true), lettura(2, 0, true)] });
        expect(numero()).toBeNull();
        await clic(uno('.zr-bell'));
        expect(numero()).toBe('1');
        const barra = uno('aside.zr-side');

        await app.visita();
        expect(app.visiteArrivate).toHaveLength(1);
        expect(numero()).toBeNull();
        expect(uno('aside.zr-side')).toBe(barra);
    });

    it('senza il segno, coi dati della v1.2.0, la visita dopo che porta di nuovo zero lascia 1 sulla campanella (il difetto; sprint 10 · T2.2)', async () => {
        const app = await avvia({ conLayout: true, letture: [lettura(1, 0, false), lettura(2, 0, false)] });
        await clic(uno('.zr-bell'));
        expect(numero()).toBe('1');

        await app.visita();
        expect(app.visiteArrivate).toHaveLength(1);
        expect(numero()).toBe('1');
    });

    it('con `Cornice` dentro la pagina, senza layout, e una visita con preserveState vale lo stesso: zero con un segno nuovo toglie il numero dalla campanella, senza cambiare niente nel frontend (sprint 10 · T2.4)', async () => {
        const app = await avvia({ conLayout: false, letture: [lettura(1, 0, true), lettura(2, 0, true)] });
        expect(numero()).toBeNull();
        await clic(uno('.zr-bell'));
        expect(numero()).toBe('1');
        const barra = uno('aside.zr-side');

        await app.visita({ preserveState: true });
        expect(app.visiteArrivate).toHaveLength(1);
        expect(numero()).toBeNull();
        // La pagina è rimasta montata, e la cornice con lei.
        expect(uno('aside.zr-side')).toBe(barra);
    });

    it('con `Cornice` dentro la pagina, senza il segno, la visita con preserveState che porta di nuovo zero lascia 1 sulla campanella (il difetto; sprint 10 · T2.4)', async () => {
        const app = await avvia({ conLayout: false, letture: [lettura(1, 0, false), lettura(2, 0, false)] });
        await clic(uno('.zr-bell'));
        expect(numero()).toBe('1');
        const barra = uno('aside.zr-side');

        await app.visita({ preserveState: true });
        expect(app.visiteArrivate).toHaveLength(1);
        expect(numero()).toBe('1');
        expect(uno('aside.zr-side')).toBe(barra);
    });
});
