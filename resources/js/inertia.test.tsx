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

/** L'istante numero `numero` sull'orologio della parte server finta, nella forma del segno: in UTC, coi microsecondi. */
const istante = (numero: number) => `2026-10-09T21:31:${String(numero).padStart(2, '0')}.123456Z`;

/**
 * I dati di una lettura, come li dà `Cornice::dati()`: uguali in tutto a quelli delle altre letture con lo stesso numero di
 * non lette, tranne il segno, che è l'istante della lettura. `colSegno` `false` li dà come la `v1.2.0`, senza. `nome` è il nome
 * del workspace, in cima alla sidebar.
 */
function lettura(numero: number, nonLette: number, colSegno: boolean, nome = 'UAT Marketing'): DatiDellaCornice {
    return {
        lingua: 'it',
        persona: { nome: 'UAT Ada Lovelace', email: 'uat-ada@example.com' },
        workspace: { nome, slug: 'uat-marketing' },
        prodotti: { pm: 'attivo', crm: 'disponibile' },
        aziende: [{ id: 'uat-az', nome: 'UAT Acme', workspace: [{ nome, slug: 'uat-marketing' }] }],
        non_lette: nonLette,
        ...(colSegno ? { aggiornati_il: istante(numero) } : {}),
    };
}

/** La pagina di Inertia che la parte server risponde, coi dati di quella lettura: senza altro, sempre lo stesso componente allo stesso indirizzo. */
function pagina(cornice: DatiDellaCornice, url = indirizzo, componente = 'Pagina') {
    return { component: componente, url, props: { errors: {}, cornice }, version: null, flash: {}, rescuedProps: [], rememberedState: {} };
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

async function giri(quanti: number): Promise<void> {
    for (let fatti = 0; fatti < quanti; fatti += 1) {
        await giro();
    }
}

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
/** L'indirizzo della pagina in cui si è. */
const dove = () => window.location.pathname;
/** Il nome del workspace in cima alla sidebar, nel selettore «Azienda › workspace». */
const nomeDelWorkspace = () => uno('aside.zr-side .zr-ws-switch .zr-ws-name')?.textContent ?? null;

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

// Sprint 11 · T2 (voce #1458). La cornice sotto il layout fra due pagine, con Indietro e Avanti del browser, una visita che
// arriva tardi e una pagina che il `prefetch` di Inertia teneva. La parte server finta ha un orologio: la pagina con cui l'app
// si apre è la lettura 1, e ogni richiesta che le arriva (una visita, l'elenco delle notifiche, «Segna tutte come lette») prende
// l'istante dopo. Una visita lo prende quando arriva e risponde quando lo dice il test: i suoi dati portano il segno
// dell'arrivo, anche se la risposta viene consegnata dopo altro. Coi segni la cornice tiene i dati più recenti che ha visto, e
// sa quando l'elenco è stato letto e quando la lettura è stata segnata. Ogni scenario ha qui accanto lo stesso giro senza i
// segni, coi dati e le risposte delle rotte come nella `v1.2.1`: lì torna ciò che è più vecchio.
describe('la cornice sotto Inertia vera non torna a dati più vecchi', () => {
    const origine = 'https://uat.example.com';
    /** L'altra pagina: un altro indirizzo e un altro componente, sotto lo stesso layout. */
    const altroIndirizzo = '/w/uat-marketing/altra';

    /**
     * L'app sotto `LayoutDellaCornice`, aperta su `indirizzo` coi dati della lettura 1. `conSegni` `false` toglie il segno dai
     * dati e l'istante dalle risposte delle due rotte delle notifiche.
     */
    async function apri({ conSegni, nonLette, nome }: { conSegni: boolean; nonLette: number; nome?: string }) {
        vi.resetModules();
        const { createInertiaApp, http, router } = await import('@inertiajs/react');
        const react = await import('react');
        const { createRoot } = await import('react-dom/client');
        const { LayoutDellaCornice } = await import('./index');
        act = react.act;

        /** L'orologio della parte server: l'istante dell'ultima cosa che ha letto o segnato. */
        let orologio = 0;
        /** Le visite arrivate alla parte server, nell'ordine: ognuna ha letto i dati al suo arrivo, e risponde quando il test la consegna. */
        const arrivate: { percorso: string; consegna: (nonLetteLette: number, nomeLetto?: string) => void }[] = [];
        http.setClient({
            request: (richiesta) =>
                new Promise((risolvi) => {
                    const url = new URL(richiesta.url, origine);
                    const percorso = url.pathname + url.search;
                    const letta = ++orologio;
                    arrivate.push({
                        percorso,
                        consegna: (nonLetteLette, nomeLetto) =>
                            risolvi({ status: 200, data: JSON.stringify(pagina(lettura(letta, nonLetteLette, conSegni, nomeLetto), percorso, componenteDi(percorso))), headers: { 'x-inertia': 'true' } }),
                    });
                }),
        });
        // Le due rotte delle notifiche dicono quando, sullo stesso orologio: l'elenco quando è letto, la lettura quando è segnata.
        vi.stubGlobal(
            'fetch',
            vi.fn(async (rotta: string, opzioni?: RequestInit) => {
                const adesso = ++orologio;
                if (rotta === '/cornice/notifiche') {
                    return risposta({ data: notificheDelServer, ...(conSegni ? { aggiornati_il: istante(adesso) } : {}) });
                }
                if (rotta === '/cornice/notifiche/letture') {
                    const finoA = new Date(String((JSON.parse(String(opzioni?.body)) as { fino_a?: unknown }).fino_a)).toISOString();

                    return risposta({ data: { fino_a: finoA }, ...(conSegni ? { segnate_il: istante(adesso) } : {}) });
                }

                return risposta({ data: [] });
            }),
        );
        // Il browser tiene in cronologia una copia dello stato. happy-dom ridà lo stesso oggetto: senza la copia, Avanti
        // porterebbe alla pagina gli stessi dati che aveva, e la campanella resterebbe giusta anche senza i segni.
        for (const metodo of ['pushState', 'replaceState'] as const) {
            const vero = window.history[metodo].bind(window.history);
            vi.spyOn(window.history, metodo).mockImplementation((stato, titolo, url) => vero(structuredClone(stato), titolo, url));
        }

        function Layout({ cornice, children }: { cornice?: DatiDellaCornice | null; children?: ReactNode }) {
            return (
                <LayoutDellaCornice cornice={cornice} onLogout={esciSenzaEffetto}>
                    {children}
                </LayoutDellaCornice>
            );
        }

        function Pagina() {
            return <p id="uat-pagina">UAT pagina</p>;
        }

        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(origine + indirizzo);
        await act(async () => {
            await createInertiaApp({
                page: pagina(lettura(++orologio, nonLette, conSegni, nome)),
                resolve: () => Pagina,
                layout: () => Layout,
                progress: false,
                setup: ({ el, App, props }) => {
                    radice = createRoot(el as HTMLElement);
                    radice.render(react.createElement(App, props));
                },
            });
            await giri(3);
        });

        return {
            /** Gli indirizzi delle visite arrivate alla parte server, nell'ordine. */
            visite: () => arrivate.map((arrivata) => arrivata.percorso),
            /** Una visita parte: la richiesta arriva alla parte server, che legge i dati; la risposta aspetta. */
            async parte(url: string): Promise<void> {
                await act(async () => {
                    router.visit(url);
                    await giri(5);
                });
            },
            /** La risposta di una visita arrivata, coi dati letti al suo arrivo: quelle non lette, e il nome del workspace. */
            async consegna(indice: number, nonLetteLette: number, nomeLetto?: string): Promise<void> {
                await act(async () => {
                    arrivate[indice].consegna(nonLetteLette, nomeLetto);
                    await giri(30);
                });
            },
            /** Inertia scarica una pagina in anticipo e la tiene trenta secondi: la visita dopo usa quella, senza un'altra richiesta. */
            async prefetch(url: string): Promise<void> {
                await act(async () => {
                    router.prefetch(url, { method: 'get' }, { cacheFor: 30_000 });
                    await giri(5);
                });
            },
            /** Indietro o Avanti del browser. */
            async cronologia(passo: 'back' | 'forward'): Promise<void> {
                await act(async () => {
                    window.history[passo]();
                    await giri(30);
                });
            },
        };
    }

    const componenteDi = (percorso: string) => (percorso === altroIndirizzo ? 'Altra' : 'Pagina');

    /** «Segna tutte come lette» sulla seconda pagina, poi Indietro e Avanti del browser: dove si è e il numero, a ogni passo. */
    async function indietroEAvantiDopoSegnaTutte(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 3 });
        await app.parte(altroIndirizzo);
        await app.consegna(0, 3);
        const dopoLaVisita = [dove(), numero()];
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        const segnate = [dove(), numero()];
        await app.cronologia('back');
        const indietro = [dove(), numero()];
        await app.cronologia('forward');
        const avanti = [dove(), numero()];

        return { dopoLaVisita, segnate, indietro, avanti, visite: app.visite() };
    }

    it('dopo «Segna tutte come lette», Indietro porta a una pagina coi dati letti prima del clic e Avanti riporta a quella del clic, con una copia dei suoi dati: la campanella resta senza numero tutte e due le volte (sprint 11 · T2.1)', async () => {
        expect(await indietroEAvantiDopoSegnaTutte(true)).toStrictEqual({
            dopoLaVisita: [altroIndirizzo, '3'],
            segnate: [altroIndirizzo, null],
            indietro: [indirizzo, null],
            avanti: [altroIndirizzo, null],
            visite: [altroIndirizzo],
        });
    });

    it('senza i segni, dopo «Segna tutte come lette» Indietro rimette sulla campanella il numero di allora, e Avanti pure (il difetto; sprint 11 · T2.1, T2.6)', async () => {
        expect(await indietroEAvantiDopoSegnaTutte(false)).toStrictEqual({
            dopoLaVisita: [altroIndirizzo, '3'],
            segnate: [altroIndirizzo, null],
            indietro: [indirizzo, '3'],
            avanti: [altroIndirizzo, '3'],
            visite: [altroIndirizzo],
        });
    });

    /** Una visita con un altro numero e un altro nome del workspace, poi Indietro e Avanti: dove si è, il numero e il nome, a ogni passo. */
    async function indietroDopoUnaVisitaConAltriDati(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 3, nome: 'UAT Marketing' });
        const siVede = () => [dove(), numero(), nomeDelWorkspace()];
        const allInizio = siVede();
        await app.parte(altroIndirizzo);
        await app.consegna(0, 5, 'UAT Marketing Europa');
        const dopoLaVisita = siVede();
        await app.cronologia('back');
        const indietro = siVede();
        await app.cronologia('forward');
        const avanti = siVede();

        return { allInizio, dopoLaVisita, indietro, avanti };
    }

    it('senza «Segna tutte»: dopo una visita con un altro numero e un altro nome del workspace, Indietro lascia nella cornice il numero e il nome della visita, i dati più recenti che ha visto, non quelli della pagina ripresa dalla cronologia (sprint 11 · T2.2)', async () => {
        expect(await indietroDopoUnaVisitaConAltriDati(true)).toStrictEqual({
            allInizio: [indirizzo, '3', 'UAT Marketing'],
            dopoLaVisita: [altroIndirizzo, '5', 'UAT Marketing Europa'],
            indietro: [indirizzo, '5', 'UAT Marketing Europa'],
            avanti: [altroIndirizzo, '5', 'UAT Marketing Europa'],
        });
    });

    it('senza i segni, Indietro rimette nella cornice il numero e il nome della pagina ripresa dalla cronologia (il difetto; sprint 11 · T2.2, T2.6)', async () => {
        expect(await indietroDopoUnaVisitaConAltriDati(false)).toStrictEqual({
            allInizio: [indirizzo, '3', 'UAT Marketing'],
            dopoLaVisita: [altroIndirizzo, '5', 'UAT Marketing Europa'],
            indietro: [indirizzo, '3', 'UAT Marketing'],
            avanti: [altroIndirizzo, '5', 'UAT Marketing Europa'],
        });
    });

    /** Una visita vera dopo, coi dati letti più tardi e un numero più basso: il numero prima e dopo. */
    async function visitaDopoConUnNumeroPiuBasso(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 5 });
        const allInizio = numero();
        await app.parte(altroIndirizzo);
        await app.consegna(0, 3);

        return { allInizio, dopoLaVisita: [dove(), numero()] };
    }

    /** «Segna tutte come lette», poi una visita partita dopo, coi dati letti dopo la lettura e lo stesso numero di prima del clic. */
    async function visitaLettaDopoSegnaTutte(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 3 });
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        const segnate = numero();
        await app.parte(altroIndirizzo);
        await app.consegna(0, 3);

        return { segnate, dopoLaVisita: [dove(), numero()] };
    }

    const coiSegniESenza: [string, boolean][] = [
        ['coi segni', true],
        ['senza i segni', false],
    ];

    it.each(coiSegniESenza)('%s, una visita vera dopo, coi dati letti più tardi, vale: la campanella mostra il suo numero anche se è più basso (sprint 11 · T2.3, T2.6)', async (_come, conSegni) => {
        expect(await visitaDopoConUnNumeroPiuBasso(conSegni)).toStrictEqual({ allInizio: '5', dopoLaVisita: [altroIndirizzo, '3'] });
    });

    it.each(coiSegniESenza)('%s, dopo «Segna tutte come lette» una visita letta dopo la lettura mostra il suo numero, anche se è lo stesso di prima del clic (sprint 11 · T2.3, T2.6)', async (_come, conSegni) => {
        expect(await visitaLettaDopoSegnaTutte(conSegni)).toStrictEqual({ segnate: null, dopoLaVisita: [altroIndirizzo, '3'] });
    });

    /** Una visita già partita quando arriva il clic su «Segna tutte come lette»: letta prima, consegnata dopo. */
    async function visitaInVoloDuranteSegnaTutte(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 3 });
        await clic(uno('.zr-bell'));
        await app.parte(altroIndirizzo);
        const inVolo = [dove(), numero(), app.visite()];
        await clic(segnaTutte());
        const segnate = [dove(), numero()];
        await app.consegna(0, 3);
        const arrivata = [dove(), numero()];

        return { inVolo, segnate, arrivata };
    }

    it('dopo «Segna tutte come lette», la risposta di una visita già partita, letta prima del clic e arrivata dopo, non rimette il numero (sprint 11 · T2.4)', async () => {
        expect(await visitaInVoloDuranteSegnaTutte(true)).toStrictEqual({
            inVolo: [indirizzo, '3', [altroIndirizzo]],
            segnate: [indirizzo, null],
            arrivata: [altroIndirizzo, null],
        });
    });

    it('senza i segni, la risposta di una visita letta prima del clic e arrivata dopo rimette il numero di prima (il difetto; sprint 11 · T2.4, T2.6)', async () => {
        expect(await visitaInVoloDuranteSegnaTutte(false)).toStrictEqual({
            inVolo: [indirizzo, '3', [altroIndirizzo]],
            segnate: [indirizzo, null],
            arrivata: [altroIndirizzo, '3'],
        });
    });

    /** Una pagina che il `prefetch` di Inertia ha scaricato prima del clic su «Segna tutte come lette», e che la visita dopo usa. */
    async function paginaTenutaDalPrefetch(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 3 });
        await app.prefetch(altroIndirizzo);
        await app.consegna(0, 3);
        const scaricata = [dove(), numero(), app.visite()];
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        const segnate = [dove(), numero()];
        await app.parte(altroIndirizzo);
        await giri(30);
        const visita = [dove(), numero(), app.visite()];

        return { scaricata, segnate, visita };
    }

    it('dopo «Segna tutte come lette», una pagina che il prefetch di Inertia teneva da prima del clic non rimette il numero quando la visita la usa, senza un\'altra richiesta (sprint 11 · T2.4)', async () => {
        expect(await paginaTenutaDalPrefetch(true)).toStrictEqual({
            scaricata: [indirizzo, '3', [altroIndirizzo]],
            segnate: [indirizzo, null],
            visita: [altroIndirizzo, null, [altroIndirizzo]],
        });
    });

    it('senza i segni, la pagina che il prefetch teneva da prima del clic rimette il numero di prima (il difetto; sprint 11 · T2.4, T2.6)', async () => {
        expect(await paginaTenutaDalPrefetch(false)).toStrictEqual({
            scaricata: [indirizzo, '3', [altroIndirizzo]],
            segnate: [indirizzo, null],
            visita: [altroIndirizzo, '3', [altroIndirizzo]],
        });
    });

    /** Una visita letta prima che il pannello caricasse l'elenco, con zero non lette, e consegnata dopo. */
    async function visitaLettaPrimaDellElenco(conSegni: boolean) {
        const app = await apri({ conSegni, nonLette: 0 });
        const allInizio = numero();
        await app.parte(altroIndirizzo);
        await clic(uno('.zr-bell'));
        const conLElenco = [dove(), numero()];
        await app.consegna(0, 0);
        const arrivata = [dove(), numero()];

        return { allInizio, conLElenco, arrivata };
    }

    it('una risposta letta prima che il pannello caricasse l\'elenco e arrivata dopo non toglie dalla campanella la non letta dell\'elenco (sprint 11 · T2.5)', async () => {
        expect(await visitaLettaPrimaDellElenco(true)).toStrictEqual({ allInizio: null, conLElenco: [indirizzo, '1'], arrivata: [altroIndirizzo, '1'] });
    });

    it('senza i segni, la risposta letta prima dell\'elenco e arrivata dopo toglie dalla campanella la non letta dell\'elenco (il difetto; sprint 11 · T2.5, T2.6)', async () => {
        expect(await visitaLettaPrimaDellElenco(false)).toStrictEqual({ allInizio: null, conLElenco: [indirizzo, '1'], arrivata: [altroIndirizzo, null] });
    });
});
