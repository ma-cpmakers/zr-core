import { act, useEffect, useLayoutEffect, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { DatiDopo as DatiDopoDiApp, DatiSubito as DatiSubitoDiApp } from './app';
import { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type DatiDellaCornice, type DatiDopo, type DatiSubito, type GruppoDiVoci, type LayoutDellaCorniceProps } from './index';
import { testi } from './lingue';

// Sprint 9 · T1 e T2 (voce #1398). `LayoutDellaCornice` reso in un DOM finto come lo rende Inertia: a ogni visita lo stesso
// layout, la pagina con una `key` nuova e i dati della parte server di quella pagina (`cornice`). La cornice resta montata
// mentre la pagina cambia, finché il workspace è lo stesso, e la pagina le dà ciò che sa solo lei con `useCornice`. Con Inertia
// vera, nel browser, lo prova la pagina di prova del layout.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile' },
    non_lette: 7,
};
/** I dati della pagina dopo, nello stesso workspace: un altro oggetto, il workspace con un altro nome, un altro numero di non lette. */
const datiDopo: DatiDellaCornice = { ...dati, workspace: { nome: 'Marketing Europa', slug: 'acme-marketing' }, non_lette: 3 };
/** I dati di una visita che porta un altro workspace: un altro slug. */
const datiAltroWorkspace: DatiDellaCornice = { ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' }, non_lette: 5 };
const esciSenzaEffetto = () => {};
const percorso = [{ label: 'Marketing', href: 'https://board.zeiras.com/w/acme-marketing' }, { label: 'Q4 launch' }];
/** Le notifiche come le dà GET /cornice/notifiche, dalla più recente. */
const notificheDelServer = [
    { id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm' },
    { id: 'uat-n40', creata_il: '2026-10-05T12:00:00Z', letta: true, app: null },
];
/** Un risultato come lo dà POST /cornice/ricerca. */
const risultatiDelServer = [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1' }];

function PaginaA() {
    return <p id="uat-pagina-a">UAT pagina A</p>;
}

function PaginaB() {
    return <p id="uat-pagina-b">UAT pagina B</p>;
}

/** Le voci di un prodotto: nessuna ha un indirizzo, e al clic chiamano `onNavigate`. */
const voci: GruppoDiVoci[] = [{ group: 'UAT gruppo', items: [{ id: 'uat-a', label: 'UAT A', icon: 'board' }, { id: 'uat-b', label: 'UAT B', icon: 'list' }] }];

/** Una pagina che dà alla cornice ciò che riceve. */
function PaginaCheDa({ cose }: { cose: CorniceDellaPagina }) {
    useCornice(cose);

    return <p id="uat-pagina-che-da">UAT pagina che dà</p>;
}

/** Una pagina che conta i suoi montaggi. */
function PaginaCheSiConta({ conta }: { conta: { montaggi: number } }) {
    useEffect(() => {
        conta.montaggi += 1;
    }, [conta]);

    return <p id="uat-pagina-che-si-conta">UAT pagina che si conta</p>;
}

/** Un'azione per la topbar che conta i suoi montaggi. */
function AzioneCheSiConta({ conta }: { conta: { montaggi: number } }) {
    useEffect(() => {
        conta.montaggi += 1;
    }, [conta]);

    return (
        <button id="uat-azione" type="button">
            UAT azione
        </button>
    );
}

/** Una pagina con uno stato suo: a ogni render dà alla cornice una funzione nuova, che porta il conteggio di quel render. */
function PaginaCheConta({ conta, segna }: { conta: { render: number }; segna: (conteggio: number) => void }) {
    const [conteggio, setConteggio] = useState(0);
    conta.render += 1;
    useCornice({ create: [{ label: 'UAT Board', onClick: () => segna(conteggio) }] });

    return (
        <button id="uat-conta" type="button" onClick={() => setConteggio(conteggio + 1)}>
            UAT conta
        </button>
    );
}

/** Una pagina che conta i suoi montaggi e prova a dare il percorso con `useCornice`. */
function PaginaColPercorso({ conta }: { conta: { montaggi: number } }) {
    useEffect(() => {
        conta.montaggi += 1;
    }, [conta]);
    // @ts-expect-error Il percorso non passa da `useCornice`: dato dopo il montaggio, la pagina si monterebbe due volte (T2.6).
    useCornice({ crumbs: percorso });

    return <p id="uat-pagina-col-percorso">UAT pagina col percorso</p>;
}

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // I 300 ms che l'`AppShell` aspetta dopo l'ultimo tasto passano quando lo dice il test.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Le rotte della cornice: le notifiche qui sopra, e nessun risultato della ricerca, che dice il suo workspace.
    vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta(indirizzo === '/cornice/notifiche' ? { data: notificheDelServer } : { data: [], workspace: dati.workspace.slug })));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    // Prima la pulizia, poi il controllo: un test che scrive in console non lascia i suoi finti a quelli dopo.
    const errori = [...vi.mocked(console.error).mock.calls];
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // Nessun errore in console, nemmeno un avviso di React (T1.3).
    expect(errori).toStrictEqual([]);
});

async function mostra(elemento: ReactElement): Promise<void> {
    await act(async () => radice.render(elemento));
}

/** Una visita di Inertia: lo stesso layout, la pagina nuova e i dati della parte server di quella pagina. */
function visita(cornice: DatiDellaCornice | null | undefined, pagina: ReactElement, delLayout: Partial<LayoutDellaCorniceProps> = {}): Promise<void> {
    return mostra(
        <LayoutDellaCornice cornice={cornice} onLogout={esciSenzaEffetto} {...delLayout}>
            {pagina}
        </LayoutDellaCornice>,
    );
}

/** Il giro dopo, coi timer finti: le risposte già pronte delle rotte finte arrivano. */
const giro = () => vi.advanceTimersByTimeAsync(0);

/** Un clic, e una richiesta partita dal clic con la risposta già pronta arriva prima del controllo. */
async function clic(elemento: Element | null): Promise<void> {
    expect(elemento).not.toBeNull();
    await act(async () => {
        (elemento as HTMLElement).click();
        await giro();
    });
}

/**
 * Scrive una parola nel campo della ricerca, come una persona, e lascia passare i 300 ms dopo cui l'`AppShell` chiama `onSearch`;
 * con un'attesa più corta il pannello è aperto e la cornice non ha ancora cercato.
 */
async function scrivi(parola: string, attesa = 300): Promise<void> {
    const campo = uno('.zr-search input') as HTMLInputElement;
    await act(async () => {
        // Chi scrive ha il fuoco nel campo, come una persona.
        campo.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, parola);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(attesa);
        await giro();
    });
}

/** Una risposta di una rotta della cornice, come `fetch` la dà: lo stato e il corpo JSON. */
function risposta(corpo: unknown, stato = 200): Response {
    return { ok: stato >= 200 && stato < 300, status: stato, json: async () => corpo } as Response;
}

function uno(selettore: string): HTMLElement | null {
    return contenitore.querySelector<HTMLElement>(selettore);
}

function tutti(selettore: string): HTMLElement[] {
    return [...contenitore.querySelectorAll<HTMLElement>(selettore)];
}

/** Le richieste partite, nell'ordine: metodo, indirizzo e, se c'è, il corpo (la ricerca ci porta la parola cercata). */
const richieste = () => vi.mocked(fetch).mock.calls.map(([indirizzo, opzioni]) => [opzioni?.method ?? 'GET', String(indirizzo), ...(opzioni?.body == null ? [] : [String(opzioni.body)])].join(' '));

/** I titoli dei risultati nel pannello della ricerca. */
const titoliDellaRicerca = () => tutti('.zr-search-panel [role="option"] .zr-search-title').map((titolo) => titolo.textContent);

/** Gli elementi che Inertia tratta da scroll-region: li cerca così, in tutto il documento. */
const regioni = () => [...document.querySelectorAll('[scroll-region]')];

/** I nomi delle voci accese nella barra. */
const accese = () => tutti('a.zr-nav-item[aria-current=page]').map((voce) => voce.querySelector('.zr-nav-label')?.textContent);

/** Le voci del menu «+» aperto, coi loro nomi: il menu si cerca in tutto il documento. */
const vociDelPiu = () => [...document.querySelectorAll<HTMLElement>('button.zr-menu-item[role=menuitem]')];
const nomiDelPiu = () => vociDelPiu().map((voce) => voce.querySelector('.zr-menu-label')?.textContent);

describe('LayoutDellaCornice', () => {
    it('quando la pagina cambia barra laterale e topbar sono gli stessi nodi, il campo della ricerca porta ancora il testo scritto e il pannello delle notifiche resta aperto con le sue notifiche, senza un\'altra GET /cornice/notifiche (sprint 9 · T1.1)', async () => {
        await visita(dati, <PaginaA key="1" />);
        await scrivi('uat');
        await clic(uno('.zr-bell'));
        const barra = uno('aside.zr-side');
        const topbar = uno('header.zr-top');
        expect(barra).not.toBeNull();
        expect(topbar).not.toBeNull();
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche']);

        // Un'altra pagina dello stesso workspace, coi dati della sua visita: un altro componente e un altro oggetto `cornice`.
        await visita(datiDopo, <PaginaB key="2" />);
        expect(uno('#uat-pagina-a')).toBeNull();
        expect(uno('#uat-pagina-b')?.textContent).toBe('UAT pagina B');
        expect(uno('aside.zr-side')).toBe(barra);
        expect(uno('header.zr-top')).toBe(topbar);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('uat');
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche']);
    });

    it('dopo il cambio di pagina la cornice montata mostra i dati nuovi: le non lette sulla campanella e il nome del workspace in cima alla barra (sprint 9 · T1.2)', async () => {
        await visita(dati, <PaginaA key="1" />);
        const barra = uno('aside.zr-side');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Marketing');

        await visita(datiDopo, <PaginaB key="2" />);
        expect(uno('.zr-bell-count')?.textContent).toBe('3');
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Marketing Europa');
        // È la cornice di prima coi dati nuovi, non una rifatta.
        expect(uno('aside.zr-side')).toBe(barra);
    });

    // Sprint 13 · T3 (voce #1480). La parte server rimette nella sessione la lingua e il nome cambiati nel profilo: una visita
    // può portare, nello stesso workspace, dati letti dopo con un'altra lingua e un altro nome. La cornice legge la lingua dai
    // dati a ogni render: resta montata e cambia i testi.
    it('una visita coi dati letti dopo nello stesso workspace, in spagnolo e con un altro nome, lascia la cornice montata e la porta alla lingua e al nome nuovi: gli stessi nodi e il testo scritto nella ricerca, e in spagnolo il titolo dei prodotti, i loro nomi e il segnaposto della ricerca (sprint 13 · T3.1)', async () => {
        // Due letture della parte server, col loro segno: la seconda è di un secondo dopo.
        const inItaliano: DatiDellaCornice = { ...dati, aggiornati_il: '2026-10-10T09:00:00.123456Z' };
        const inSpagnolo: DatiDellaCornice = { ...inItaliano, lingua: 'es', persona: { nome: 'Augusta King', email: 'ada@example.com' }, aggiornati_il: '2026-10-10T09:00:01.123456Z' };
        const titoloDeiProdotti = () => uno('.zr-nav .zr-nav-group .zr-nav-title')?.textContent;
        const nomiDeiProdotti = () => tutti('.zr-nav .zr-nav-group a.zr-nav-item .zr-nav-label').map((voce) => voce.textContent);
        const segnaposto = () => (uno('.zr-search input[type=search]') as HTMLInputElement).placeholder;

        await visita(inItaliano, <PaginaA key="1" />);
        await scrivi('uat');
        const barra = uno('aside.zr-side');
        const topbar = uno('header.zr-top');
        expect(barra).not.toBeNull();
        expect(topbar).not.toBeNull();
        expect(titoloDeiProdotti()).toBe('Moduli');
        expect(nomiDeiProdotti()).toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti']);
        expect(segnaposto()).toBe('Cerca nel workspace…');
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe('Ada Lovelace');

        await visita(inSpagnolo, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')?.textContent).toBe('UAT pagina B');
        // È la cornice di prima, non una rifatta: i nodi sono quelli, e il campo della ricerca porta ancora il testo scritto.
        expect(uno('aside.zr-side')).toBe(barra);
        expect(uno('header.zr-top')).toBe(topbar);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('uat');
        // I testi sono quelli di `resources/lingue/es.json`.
        expect(titoloDeiProdotti()).toBe('Módulos');
        expect(nomiDeiProdotti()).toStrictEqual(['Dashboard', 'Gestión de proyectos', 'CRM', 'Reservas', 'Informes', 'Automatismos', 'Contenidos']);
        expect(segnaposto()).toBe('Busca en el workspace…');
        // Il menu del profilo porta il nome nuovo.
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual(['Augusta King', 'ada@example.com']);
    });

    it('quando una visita porta un altro workspace la cornice si rifà: il campo della ricerca è vuoto e senza i risultati di prima, il pannello delle notifiche è chiuso, e riaprire la campanella fa partire un\'altra GET /cornice/notifiche; la pagina nuova si monta una volta sola (sprint 9 · T1.6)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta(indirizzo === '/cornice/notifiche' ? { data: notificheDelServer } : { data: risultatiDelServer, workspace: dati.workspace.slug })));
        await visita(dati, <PaginaA key="1" />);
        await scrivi('uat');
        expect(titoliDellaRicerca()).toStrictEqual(['UAT Lancio Q1']);
        await clic(uno('.zr-bell'));
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        const barra = uno('aside.zr-side');

        // Un altro slug: ricerca, pannelli e notifiche erano del workspace di prima, e non restano.
        const conta = { montaggi: 0 };
        await visita(datiAltroWorkspace, <PaginaCheSiConta key="2" conta={conta} />);
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Vendite');
        expect(uno('.zr-bell-count')?.textContent).toBe('5');
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('');
        expect(uno('.zr-search-panel')).toBeNull();
        expect(uno('.zr-notif')).toBeNull();
        // È una cornice nuova, non quella di prima coi dati nuovi; e la pagina si monta una volta.
        expect(uno('aside.zr-side')).not.toBeNull();
        expect(uno('aside.zr-side')).not.toBe(barra);
        expect(uno('#uat-pagina-che-si-conta')?.textContent).toBe('UAT pagina che si conta');
        expect(conta.montaggi).toBe(1);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche']);

        // I risultati di prima non ci sono più: scrivendo, il pannello si riapre subito, prima che la cornice cerchi (i 300 ms
        // non passano), e non ne mostra nessuno. Il pannello chiuso da solo non lo dice: lo aveva già chiuso la campanella.
        await scrivi('ua', 0);
        expect(uno('.zr-search-panel')).not.toBeNull();
        expect(titoliDellaRicerca()).toStrictEqual([]);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche']);

        // Le notifiche sono del workspace nuovo: la campanella le chiede di nuovo.
        await clic(uno('.zr-bell'));
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche', 'GET /cornice/notifiche']);
    });

    // Sprint 27 · T4 (lettura della PR #59, R2). Il freno della ricerca è della cornice montata: una visita che porta un altro
    // workspace la rifà, e lì la prima parola parte anche se nel workspace di prima il freno non era scaduto.
    it('dopo un 429 della ricerca con `Retry-After: 60` un\'altra parola nello stesso workspace non parte; una visita che porta un altro workspace rifà la cornice, e lì la prima parola scritta parte subito (sprint 27 · T4.3)', async () => {
        const frenata = { ok: false, status: 429, headers: new Headers({ 'Retry-After': '60' }), json: async () => ({ errore: 'troppe_richieste' }) } as unknown as Response;
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string) => risposta({ data: risultatiDelServer, workspace: datiAltroWorkspace.workspace.slug })).mockResolvedValueOnce(frenata));
        const sottoIlCampo = () => tutti('.zr-search-note').map((nota) => nota.textContent);
        await visita(dati, <PaginaA key="1" />);
        await scrivi('uat');
        await scrivi('uat lancio');
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}']);
        expect(sottoIlCampo()).toStrictEqual(['La ricerca non ha risposto. Riprova tra poco.']);

        await visita(datiAltroWorkspace, <PaginaB key="2" />);
        await scrivi('lancio');
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}', 'POST /cornice/ricerca {"q":"lancio"}']);
        expect([titoliDellaRicerca(), sottoIlCampo()]).toStrictEqual([['UAT Lancio Q1'], []]);
    });

    it('quando una visita porta un altro workspace ciò che aveva dato la pagina di prima non si monta nella cornice rifatta, nemmeno per un render (sprint 9 · T1.6)', async () => {
        const prima = { montaggi: 0 };
        const dopo = { montaggi: 0 };
        await visita(dati, <PaginaCheDa key="1" cose={{ actions: <AzioneCheSiConta conta={prima} /> }} />);
        expect(uno('header.zr-top #uat-azione')).not.toBeNull();
        expect(prima.montaggi).toBe(1);

        // La pagina del workspace nuovo dà un'azione dello stesso tipo: nasce dalla sua, non da quella della pagina di prima.
        await visita(datiAltroWorkspace, <PaginaCheDa key="2" cose={{ actions: <AzioneCheSiConta conta={dopo} /> }} />);
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Vendite');
        expect(uno('header.zr-top #uat-azione')).not.toBeNull();
        expect(prima.montaggi).toBe(1);
        expect(dopo.montaggi).toBe(1);
    });

    it.each<[null | undefined]>([[null], [undefined]])('senza dati (cornice %s) la pagina si vede da sola, senza barra né topbar; quando la pagina dopo porta i dati la cornice compare, e senza dati se ne va (sprint 9 · T1.3)', async (senzaDati) => {
        await visita(senzaDati, <PaginaA key="1" />);
        // Solo la pagina: nessun elemento del layout intorno.
        expect(contenitore.childElementCount).toBe(1);
        expect(contenitore.firstElementChild).toBe(uno('#uat-pagina-a'));
        expect(uno('#uat-pagina-a')?.textContent).toBe('UAT pagina A');
        expect(tutti('.zr-shell, .zr-side, .zr-top')).toHaveLength(0);

        await visita(dati, <PaginaB key="2" />);
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Marketing');
        expect(uno('header.zr-top .zr-bell-count')?.textContent).toBe('7');
        expect(uno('main.zr-main > #uat-pagina-b')?.textContent).toBe('UAT pagina B');

        await visita(senzaDati, <PaginaA key="3" />);
        expect(contenitore.firstElementChild).toBe(uno('#uat-pagina-a'));
        expect(uno('#uat-pagina-a')?.textContent).toBe('UAT pagina A');
        expect(tutti('.zr-shell, .zr-side, .zr-top')).toHaveLength(0);
    });

    it('con la cornice montata l\'area della pagina è una scroll-region di Inertia: `main.zr-main` e, col percorso, `div.zr-main-body`, anche quando la cornice o il percorso compaiono dopo (sprint 9 · T1.4)', async () => {
        await visita(null, <PaginaA key="1" />);
        expect(regioni()).toHaveLength(0);

        // La cornice compare con la pagina dopo.
        await visita(dati, <PaginaB key="2" />);
        expect(regioni()).toHaveLength(1);
        expect(regioni()[0]).toBe(uno('.zr-shell > main.zr-main'));
        expect(uno('.zr-main-body')).toBeNull();

        // Il percorso compare dopo: l'`AppShell` crea `div.zr-main-body` in quel momento, ed è lui che scorre.
        await visita(dati, <PaginaA key="3" />, { crumbs: percorso });
        expect(regioni()).toHaveLength(2);
        expect(regioni()[0]).toBe(uno('.zr-shell > main.zr-main'));
        expect(regioni()[1]).toBe(uno('.zr-shell > main.zr-main > div.zr-main-body'));

        // Via il percorso e poi di nuovo: `div.zr-main-body` è un elemento nuovo.
        await visita(dati, <PaginaB key="4" />);
        expect(regioni()).toHaveLength(1);
        await visita(dati, <PaginaA key="5" />, { crumbs: percorso });
        expect(regioni()).toHaveLength(2);
        expect(regioni()[1]).toBe(uno('.zr-shell > main.zr-main > div.zr-main-body'));
    });

    it('la pagina resta figlia di `main.zr-main`, o di `div.zr-main-body` col percorso: il layout non mette nessun elemento suo intorno all\'`AppShell` né alla pagina (sprint 9 · T1)', async () => {
        // Accanto all'`AppShell` ci sono solo «Salta al contenuto» (sprint 28 · T4), prima di lui, e l'avviso della cornice per il
        // lettore di schermo (sprint 22 · T2.6), dopo: nessuno dei due intorno.
        const accantoAllAppShell = () => [...contenitore.children].map((figlio) => figlio.getAttribute('role') ?? figlio.className);
        await visita(dati, <PaginaA key="1" />);
        expect(accantoAllAppShell()).toStrictEqual(['zr-visually-hidden', 'zr-shell', 'status']);
        expect(contenitore.children[1]?.className).toBe('zr-shell');
        expect(uno('#uat-pagina-a')?.parentElement).toBe(uno('.zr-shell > main.zr-main'));

        await visita(dati, <PaginaA key="1" />, { crumbs: percorso });
        expect(accantoAllAppShell()).toStrictEqual(['zr-visually-hidden', 'zr-shell', 'status']);
        expect(uno('#uat-pagina-a')?.parentElement).toBe(uno('.zr-shell > main.zr-main > div.zr-main-body'));
    });

    it('Inertia dà al layout anche le props della pagina: una che non è della cornice non arriva all\'`AppShell` (sprint 9 · T1)', async () => {
        // Due nomi che l'`AppShell` conosce e `Cornice` no: una prop della parte server con quel nome cambierebbe la cornice.
        const dellaPagina: object = { className: 'uat-della-pagina', searchPlaceholder: 'UAT della pagina' };
        await mostra(
            <LayoutDellaCornice cornice={dati} onLogout={esciSenzaEffetto} {...dellaPagina}>
                <PaginaA key="1" />
            </LayoutDellaCornice>,
        );
        expect(uno('.zr-shell')?.className).toBe('zr-shell');
        // Il segnaposto resta quello della cornice, uno solo in ogni workspace (sprint 25 · T4.3; sprint 27 · T7.1).
        expect((uno('.zr-search input') as HTMLInputElement).placeholder).toBe('Cerca nel workspace…');
    });
});

describe('useCornice', () => {
    it('una pagina sotto il layout dà alla cornice le voci del menu «+», la voce attiva, le azioni in topbar, le voci del prodotto, `onNavigate` e l\'area senza margine (sprint 9 · T2.1)', async () => {
        const creaBoard = vi.fn();
        const vaiA = vi.fn();
        const cose = { create: [{ label: 'UAT Board', icon: 'board', onClick: creaBoard }], active: 'uat-b', actions: <button id="uat-azione">UAT azione</button>, nav: voci, onNavigate: vaiA, flush: true };
        await visita(dati, <PaginaCheDa key="1" cose={cose} />, { product: 'pm' });

        // 1. Il «+» con la voce della pagina: il clic chiama la sua funzione.
        await clic(uno('button.zr-create'));
        expect(nomiDelPiu()).toStrictEqual(['UAT Board']);
        await clic(vociDelPiu()[0]);
        expect(creaBoard).toHaveBeenCalledTimes(1);
        // 2. La voce attiva è quella della pagina.
        expect(accese()).toStrictEqual(['UAT B']);
        // 3. Le azioni in topbar.
        expect(uno('header.zr-top .zr-top-actions #uat-azione')?.textContent).toBe('UAT azione');
        // 4. Le voci del prodotto, sotto il suo pulsante.
        expect(tutti('.zr-nav-group').find((gruppo) => gruppo.querySelector('.zr-nav-title')?.textContent === 'UAT gruppo')?.querySelectorAll('a.zr-nav-item')).toHaveLength(2);
        // 5. Il clic su una voce senza indirizzo chiama `onNavigate` della pagina, col suo id.
        await clic(tutti('a.zr-nav-item').find((voce) => voce.querySelector('.zr-nav-label')?.textContent === 'UAT A') ?? null);
        expect(vaiA.mock.calls).toStrictEqual([['uat-a']]);
        // 6. L'area della pagina senza margine.
        expect(uno('main.zr-main')?.className).toBe('zr-main is-flush');

        // Con un id che nessuna voce ha, nessuna è accesa; e ciò che la pagina non dà più, non c'è più.
        await visita(dati, <PaginaCheDa key="1" cose={{ nav: voci, active: 'uat-nessuna' }} />, { product: 'pm' });
        expect(tutti('a.zr-nav-item')).not.toHaveLength(0);
        expect(accese()).toStrictEqual([]);
        expect(uno('button.zr-create')).toBeNull();
        expect(uno('main.zr-main')?.className).toBe('zr-main');
    });

    it('fra layout e pagina vince la pagina, finché è montata: la voce attiva è la sua, e via la pagina torna quella del layout (sprint 9 · T2.2)', async () => {
        const delLayout = { nav: voci, active: 'uat-a' };
        await visita(dati, <PaginaCheDa key="1" cose={{ active: 'uat-b' }} />, delLayout);
        expect(accese()).toStrictEqual(['UAT B']);

        await visita(dati, <PaginaB key="2" />, delLayout);
        expect(accese()).toStrictEqual(['UAT A']);

        // Ciò che la pagina non dà resta quello del layout, anche se lo scrive `undefined`.
        await visita(dati, <PaginaCheDa key="3" cose={{ active: undefined, flush: true }} />, delLayout);
        expect(accese()).toStrictEqual(['UAT A']);
        expect(uno('main.zr-main')?.className).toBe('zr-main is-flush');
    });

    it('quando la pagina se ne va ciò che aveva dato sparisce: con una pagina nuova che non chiama `useCornice` il «+» non c\'è più (sprint 9 · T2.3)', async () => {
        const creaBoard = vi.fn();
        const creaScheda = vi.fn();
        await visita(dati, <PaginaCheDa key="1" cose={{ create: [{ label: 'UAT Board', onClick: creaBoard }], actions: <button id="uat-azione">UAT azione</button>, flush: true }} />);
        expect(uno('button.zr-create')).not.toBeNull();
        expect(uno('#uat-azione')?.textContent).toBe('UAT azione');
        expect(uno('main.zr-main')?.className).toBe('zr-main is-flush');

        await visita(datiDopo, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')?.textContent).toBe('UAT pagina B');
        expect(uno('button.zr-create')).toBeNull();
        expect(uno('#uat-azione')).toBeNull();
        expect(uno('main.zr-main')?.className).toBe('zr-main');

        // La pagina dopo dà il suo: nel «+» c'è solo la sua voce, con la sua funzione.
        await visita(dati, <PaginaCheDa key="3" cose={{ create: [{ label: 'UAT Scheda', onClick: creaScheda }] }} />);
        await clic(uno('button.zr-create'));
        expect(nomiDelPiu()).toStrictEqual(['UAT Scheda']);
        await clic(vociDelPiu()[0]);
        expect(creaScheda).toHaveBeenCalledTimes(1);
        expect(creaBoard).not.toHaveBeenCalled();
    });

    it('le funzioni possono essere nuove a ogni render: una pagina che cambia stato due volte viene resa tre volte, e il clic sul «+» chiama l\'ultima funzione (sprint 9 · T2.4)', async () => {
        const conta = { render: 0 };
        const segna = vi.fn();
        await visita(dati, <PaginaCheConta key="1" conta={conta} segna={segna} />);
        expect(conta.render).toBe(1);

        await clic(uno('#uat-conta'));
        await clic(uno('#uat-conta'));
        // Un render per ogni stato della pagina: la cornice, che prende le funzioni nuove, non la fa rendere di nuovo.
        expect(conta.render).toBe(3);

        await clic(uno('button.zr-create'));
        expect(nomiDelPiu()).toStrictEqual(['UAT Board']);
        await clic(vociDelPiu()[0]);
        expect(segna.mock.calls).toStrictEqual([[2]]);
    });

    it('dove la cornice non c\'è `useCornice` non fa niente e non lancia: una pagina fuori dal layout, e una sotto il layout senza dati (sprint 9 · T2.5)', async () => {
        const cose = { create: [{ label: 'UAT Board', onClick: () => {} }], active: 'uat-b', flush: true };
        await mostra(<PaginaCheDa cose={cose} />);
        expect(contenitore.childElementCount).toBe(1);
        expect(uno('#uat-pagina-che-da')?.textContent).toBe('UAT pagina che dà');

        await visita(null, <PaginaCheDa key="1" cose={cose} />);
        expect(contenitore.childElementCount).toBe(1);
        expect(uno('#uat-pagina-che-da')?.textContent).toBe('UAT pagina che dà');
        expect(tutti('.zr-shell, .zr-create')).toHaveLength(0);

        // Quando la cornice compare con la pagina dopo, quella pagina le dà il suo.
        await visita(dati, <PaginaCheDa key="2" cose={cose} />);
        expect(uno('button.zr-create')).not.toBeNull();
        expect(uno('main.zr-main')?.className).toBe('zr-main is-flush');
    });

    it('il percorso non passa da `useCornice`: non compila, e non arriva; dato al layout si vede, e la pagina si monta una volta sola (sprint 9 · T2.6)', async () => {
        const conta = { montaggi: 0 };
        await visita(dati, <PaginaColPercorso key="1" conta={conta} />);
        expect(uno('#uat-pagina-col-percorso')?.parentElement).toBe(uno('.zr-shell > main.zr-main'));
        expect(uno('.zr-crumbbar')).toBeNull();
        expect(conta.montaggi).toBe(1);

        const contaDopo = { montaggi: 0 };
        await visita(dati, <PaginaColPercorso key="2" conta={contaDopo} />, { crumbs: percorso });
        expect(tutti('.zr-crumbbar .zr-shell-crumbs > a, .zr-crumbbar .zr-shell-crumbs > [aria-current=page]').map((voce) => voce.textContent)).toStrictEqual(['Marketing', 'Q4 launch']);
        expect(uno('#uat-pagina-col-percorso')?.parentElement).toBe(uno('.zr-shell > main.zr-main > div.zr-main-body'));
        expect(contaDopo.montaggi).toBe(1);
    });
});

// Sprint 12 · T5 (voce #1464). Sotto il layout `active: null` arriva alla cornice come `null`, dal layout o dalla pagina: nessuna
// voce della barra è accesa. `null` è un valore: quello della pagina vince anche su una voce data dal layout.
describe('nessuna voce attiva, sotto il layout', () => {
    /** I nomi di tutte le voci della barra: «nessuna accesa» non vuol dire niente se la barra è vuota. */
    const nomiDelleVoci = () => tutti('a.zr-nav-item').map((voce) => voce.querySelector('.zr-nav-label')?.textContent);

    it('active={null} dato a LayoutDellaCornice arriva alla cornice come null: nessuna voce è accesa, nemmeno la Dashboard (sprint 12 · T5.3)', async () => {
        await visita(dati, <PaginaA key="1" />, { nav: voci, active: null });

        expect(nomiDelleVoci()).toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti', 'UAT A', 'UAT B', 'Impostazioni']);
        expect(accese()).toStrictEqual([]);
    });

    it('active: null dato dalla pagina con useCornice vince sulla voce che dà il layout: nessuna è accesa; quando la pagina se ne va torna quella del layout, e al ritorno di nuovo nessuna (sprint 12 · T5.3)', async () => {
        const delLayout = { nav: voci, active: 'uat-a' };
        await visita(dati, <PaginaCheDa key="1" cose={{ active: null }} />, delLayout);
        expect(nomiDelleVoci()).toContain('UAT A');
        expect(accese()).toStrictEqual([]);

        await visita(dati, <PaginaB key="2" />, delLayout);
        expect(accese()).toStrictEqual(['UAT A']);

        await visita(dati, <PaginaCheDa key="3" cose={{ active: null }} />, delLayout);
        expect(accese()).toStrictEqual([]);
    });

    it('col layout che dà null la voce data dalla pagina vince, e quando la pagina se ne va torna nessuna (sprint 12 · T5.3)', async () => {
        const delLayout = { nav: voci, active: null };
        await visita(dati, <PaginaCheDa key="1" cose={{ active: 'uat-b' }} />, delLayout);
        expect(accese()).toStrictEqual(['UAT B']);

        await visita(dati, <PaginaB key="2" />, delLayout);
        expect(accese()).toStrictEqual([]);

        // Ciò che la pagina scrive `undefined` resta del layout: nessuna, non la Dashboard.
        await visita(dati, <PaginaCheDa key="3" cose={{ active: undefined }} />, delLayout);
        expect(accese()).toStrictEqual([]);
    });
});

// Sprint 15 · T1 (voce #1584). La voce «Piano» del menu del profilo è spenta di default: sotto il layout la accende la prop
// `piano` data al layout, che è del modulo come il prodotto aperto.
describe('la voce «Piano», sotto il layout', () => {
    /** I nomi delle voci del menu del profilo aperto. */
    const nomiDelProfilo = () => tutti('.zr-profile-menu [role="menuitem"]').map((voce) => voce.querySelector('.zr-menu-label')?.textContent);

    it('con `piano` dato a LayoutDellaCornice il menu del profilo ha la voce «Piano»; alla visita dopo, senza, non l\'ha più (sprint 15 · T1.4)', async () => {
        await visita(dati, <PaginaA key="1" />, { piano: true });
        await clic(uno('.zr-avatar-btn'));
        expect(nomiDelProfilo()).toStrictEqual(['Profilo', 'Impostazioni', 'Piano', 'Azienda', 'Esci']);

        // La cornice resta montata, col menu aperto: è la prop del layout a decidere, a ogni render.
        await visita(dati, <PaginaB key="2" />);
        expect(nomiDelProfilo()).toStrictEqual(['Profilo', 'Impostazioni', 'Azienda', 'Esci']);
    });
});

// Sprint 34 · T4 (voce #1932). La cornice in due dati: il layout prende `subito` (i dati della sessione, dal primo disegno) e
// `dopo` (quelli del backoffice, che possono arrivare più tardi o non arrivare) al posto di `cornice`. La cornice è montata dal
// primo disegno, e la pagina non si rimonta mai.
describe('la cornice in due dati, sotto il layout', () => {
    const subito = { lingua: 'it', persona: dati.persona, workspace: dati.workspace };
    const dopo = { prodotti: dati.prodotti, non_lette: 7, aggiornati_il: '2026-10-13T08:00:00.000000Z' };
    const etichette = () => tutti('.zr-nav-label').map((voce) => voce.textContent);
    const sopraLaPagina = () => uno('.zr-main .zr-stack');
    const campo = () => uno('#uat-campo') as HTMLInputElement;
    const sottoLaRicerca = () => tutti('.zr-search-note').map((nota) => nota.textContent);
    /** Un'altra persona: un'altra email. */
    const altra = { nome: 'Augusta King', email: 'augusta@example.com' };
    const aziende = [{ id: '3', nome: 'Acme', workspace: [{ id: 'ws-2', nome: 'Vendite', slug: 'acme-vendite' }, { id: 'ws-4', nome: 'Marketing', slug: 'acme-marketing' }] }];

    function PaginaColCampo({ conta }: { conta: { montaggi: number } }) {
        useEffect(() => {
            conta.montaggi += 1;
        }, [conta]);

        return <input id="uat-campo" type="text" defaultValue="" />;
    }

    function inDue(delLayout: Pick<LayoutDellaCorniceProps, 'subito' | 'dopo' | 'cornice'>, pagina: ReactElement): Promise<void> {
        return mostra(
            <LayoutDellaCornice onLogout={esciSenzaEffetto} {...delLayout}>
                {pagina}
            </LayoutDellaCornice>,
        );
    }

    it('con `subito` e senza `dopo` la cornice è montata e ridotta: persona e workspace al loro posto, nessun modulo nel menu, nessun avviso sopra la pagina, e campanella e ricerca dicono il testo d\'attesa (sprint 34 · T4.4)', async () => {
        await inDue({ subito }, <PaginaA />);
        const t = testi('it');

        expect(uno('#uat-pagina-a')).not.toBeNull();
        expect(uno('aside.zr-side')?.textContent).toContain('Marketing');
        expect(etichette()).toContain(t.dashboard);
        expect(etichette()).not.toContain('CRM');
        expect(sopraLaPagina()).toBeNull();
        expect(contenitore.textContent).not.toContain(t.acceptanceTitle);
        expect(contenitore.textContent).not.toContain(t.downTitle);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="status"]')?.textContent).toBe(t.loading);
        expect(tutti('.zr-notif button').map((pulsante) => pulsante.textContent)).not.toContain(t.retry);
        expect(tutti('.zr-notif .zr-notif-item')).toHaveLength(0);
        await scrivi('uat');
        expect(sottoLaRicerca()).toStrictEqual([t.searchLoading]);
        expect(titoliDellaRicerca()).toStrictEqual([]);
    });

    it('la campanella aperta in attesa chiede l\'elenco una volta sola, e quando `dopo` arriva il pannello lo mostra senza chiuderlo e riaprirlo: mai «Nessuna notifica» col numero sulla campanella (review della PR #67, R2)', async () => {
        await inDue({ subito }, <PaginaA />);
        await clic(uno('.zr-bell'));
        expect(richieste()).toStrictEqual(['GET /cornice/notifiche']);

        await inDue({ subito, dopo }, <PaginaA />);

        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(uno('.zr-notif')?.textContent).not.toContain(testi('it').notificationsEmpty);
        expect(uno('.zr-bell')?.textContent).toContain('7');
        expect(richieste()).toStrictEqual(['GET /cornice/notifiche']);
    });

    it('una pagina a tutta area lo è dal primo disegno, anche in attesa: `main.zr-main` non cambia forma quando `dopo` arriva; col margine solo quando sopra la pagina c\'è un avviso (review della PR #67, R4)', async () => {
        const forma = () => uno('main.zr-main')?.className;
        await inDue({ subito }, <PaginaCheDa key="1" cose={{ flush: true }} />);
        expect(forma()).toBe('zr-main is-flush');

        await inDue({ subito, dopo }, <PaginaCheDa key="1" cose={{ flush: true }} />);
        expect(forma()).toBe('zr-main is-flush');

        await inDue({ subito, dopo: { non_letti: true, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaCheDa key="1" cose={{ flush: true }} />);
        expect(sopraLaPagina()).not.toBeNull();
        expect(forma()).toBe('zr-main');
    });

    // In attesa niente è andato storto: i dati stanno arrivando. Pannello e ricerca lo dicono con lo stato di caricamento
    // dell'`AppShell`, non con quello d'errore; `non_letti` e l'accettazione restano nell'errore, col loro testo.
    it('in attesa il pannello aperto e la ricerca con una parola sono nello stato di caricamento: un `role="status"`, nessun `role="alert"`, nessun «Riprova», e nessuna ricerca partita (sprint 35 · T1.1, T1.2, T1.3)', async () => {
        await inDue({ subito }, <PaginaA />);
        const t = testi('it');

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="status"]')?.textContent).toBe(t.loading);
        expect(uno('.zr-notif [role="alert"]')).toBeNull();
        expect(tutti('.zr-notif button').map((pulsante) => pulsante.textContent)).not.toContain(t.retry);

        // Sotto il campo con meno di due caratteri c'è l'invito di sempre, non un testo d'attesa: la parola scritta verrà cercata.
        await scrivi('u');
        expect(sottoLaRicerca()).toStrictEqual([t.searchHint]);
        await scrivi('uat');
        expect(tutti('.zr-search-note').map((nota) => nota.getAttribute('role'))).toStrictEqual(['status']);
        expect(uno('.zr-search-note.is-error')).toBeNull();
        expect(uno('.zr-search-panel')?.textContent).not.toContain(t.searchEmpty);
        expect(richieste()).toStrictEqual(['GET /cornice/notifiche']);
    });

    it.each<[string, NonNullable<LayoutDellaCorniceProps['dopo']>, 'downOff' | 'acceptanceOff']>([
        ['`non_letti`', { non_letti: true }, 'downOff'],
        ['l\'accettazione richiesta', { prodotti: [], aziende: [], non_lette: 0, aggiornati_il: dopo.aggiornati_il, accettazione_richiesta: true }, 'acceptanceOff'],
    ])('se dopo l\'attesa arriva %s, pannello e ricerca sono nello stato d\'errore col loro testo, e la parola scritta in attesa non parte (sprint 35 · T1.1, T1.2, T1.3)', async (_caso, arrivati, testo) => {
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat');

        await inDue({ subito, dopo: arrivati }, <PaginaA />);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        const t = testi('it');

        expect(tutti('.zr-search-note').map((nota) => [nota.getAttribute('role'), nota.classList.contains('is-error'), nota.textContent])).toStrictEqual([['alert', true, t[testo]]]);
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="alert"]')?.textContent).toBe(t[testo]);
        expect(uno('.zr-notif [role="status"]')).toBeNull();
        expect(richieste()).toStrictEqual([]);
    });

    it.each<[string, number]>([
        ['i 300 ms dell\'`AppShell` sono già passati', 300],
        ['i 300 ms passano dopo l\'arrivo', 100],
    ])('una parola scritta in attesa parte una volta sola, all\'arrivo di `dopo`, e il riquadro mostra i suoi risultati: %s (sprint 35 · T1.3)', async (_caso, attesa) => {
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string) => risposta({ data: risultatiDelServer, workspace: dati.workspace.slug })));
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat', attesa);
        expect(richieste()).toStrictEqual([]);

        await inDue({ subito, dopo }, <PaginaA />);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
            await giro();
        });

        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}']);
        expect(titoliDellaRicerca()).toStrictEqual(['UAT Lancio Q1']);
        expect(uno('.zr-search-panel')?.textContent).not.toContain(testi('it').searchEmpty);
    });

    it('«Nessun risultato» per la parola scritta in attesa si legge solo dopo la risposta vuota della sua ricerca (sprint 35 · T1.3)', async () => {
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat');

        await inDue({ subito, dopo }, <PaginaA />);
        await act(giro);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}']);
        expect(uno('.zr-search-panel')?.textContent).toContain(`${testi('it').searchEmpty} «uat»`);
    });

    // La parola tenuta si dimentica a ogni disegno che non è in attesa: se al posto dei dati arriva `non_letti` o l'accettazione,
    // non parte nemmeno quando poi i dati buoni arrivano.
    it.each<[string, NonNullable<LayoutDellaCorniceProps['dopo']>]>([
        ['`non_letti`', { non_letti: true, aggiornati_il: '2026-10-13T08:00:01.000000Z' }],
        ['l\'accettazione richiesta', { prodotti: [], aziende: [], non_lette: 0, aggiornati_il: '2026-10-13T08:00:01.000000Z', accettazione_richiesta: true }],
    ])('una parola scritta in attesa non parte nemmeno quando, dopo %s, arrivano i dati buoni: la cornice l\'ha dimenticata (sprint 35 · T1.3)', async (_caso, arrivati) => {
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string) => risposta({ data: risultatiDelServer, workspace: dati.workspace.slug })));
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat');

        await inDue({ subito, dopo: arrivati }, <PaginaA />);
        await inDue({ subito, dopo: { ...dopo, aggiornati_il: '2026-10-13T08:00:02.000000Z' } }, <PaginaA />);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
            await giro();
        });

        expect(uno('.zr-bell')?.textContent).toContain('7');
        expect(richieste()).toStrictEqual([]);
    });

    // Sprint 39 · T3 (voce #1971): qui c'erano i due limiti che il README dichiarava dallo sprint 35 (T4.3) — una parola
    // cancellata partiva lo stesso, e sotto una battuta meno di 300 ms prima si leggeva «Nessun risultato». All'arrivo di `dopo`
    // la cornice cerca ciò che è nel campo in quel momento: i due casi chiedono il contrario di prima.
    it('una parola scritta in attesa e poi cancellata non parte all\'arrivo di `dopo`, né dopo; sotto il campo vuoto resta l\'invito (sprint 39 · T3.1)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string) => risposta({ data: risultatiDelServer, workspace: dati.workspace.slug })));
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat');
        await scrivi('');

        await inDue({ subito, dopo }, <PaginaA />);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
            await giro();
        });

        expect(richieste()).toStrictEqual([]);
        expect(sottoLaRicerca()).toStrictEqual([expect.stringMatching(/scrivi almeno 2 caratteri\.$/)]);
        expect(titoliDellaRicerca()).toStrictEqual([]);
    });

    it('una parola scritta meno di 300 ms prima dell\'arrivo di `dopo` parte all\'arrivo, una volta sola, e sotto il campo non si legge «Nessun risultato»: né all\'arrivo, né allo scadere dei 300 ms dell\'`AppShell` (sprint 39 · T3.2)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string) => risposta({ data: risultatiDelServer, workspace: dati.workspace.slug })));
        await inDue({ subito }, <PaginaA />);
        await scrivi('uat', 100);

        await inDue({ subito, dopo }, <PaginaA />);
        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}']);
        expect(uno('.zr-search-panel')?.textContent).not.toContain(testi('it').searchEmpty);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
            await giro();
        });

        expect(richieste()).toStrictEqual(['POST /cornice/ricerca {"q":"uat"}']);
        expect(uno('.zr-search-panel')?.textContent).not.toContain(testi('it').searchEmpty);
        expect(titoliDellaRicerca().length).toBeGreaterThan(0);
    });

    it('un `non_letti` letto prima dei dati che la cornice ha non la riduce: resta quella di sempre (Indietro su una visita di quando il backoffice non rispondeva); uno letto dopo sì (review della PR #67, R5)', async () => {
        await inDue({ subito, dopo }, <PaginaA key="1" />);

        await inDue({ subito, dopo: { non_letti: true, aggiornati_il: '2026-10-13T07:59:59.000000Z' } }, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')).not.toBeNull();
        expect(etichette()).toContain('CRM');
        expect(sopraLaPagina()).toBeNull();

        await inDue({ subito, dopo: { non_letti: true, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaB key="2" />);
        expect(etichette()).not.toContain('CRM');
        expect(sopraLaPagina()?.textContent).toContain(testi('it').downTitle);
    });

    it('il workspace di `dopo` vale su quello di `subito`: se fra le due richieste la sessione è passata a un altro workspace, moduli, nome e slug sono dello stesso workspace (review della PR #67, R6)', async () => {
        await inDue({ subito, dopo: { ...dopo, workspace: datiAltroWorkspace.workspace } }, <PaginaA />);

        expect(uno('aside.zr-side')?.textContent).toContain('Vendite');
        expect(uno('aside.zr-side')?.textContent).not.toContain('Marketing');
        const neiWorkspace = tutti('a.zr-nav-item').map((voce) => voce.getAttribute('href')).filter((indirizzo) => indirizzo?.includes('/w/'));
        expect(neiWorkspace.length).toBeGreaterThan(0);
        expect(neiWorkspace.every((indirizzo) => indirizzo?.includes(`/w/${datiAltroWorkspace.workspace.slug}`))).toBe(true);
    });

    it('quando `dopo` arriva la cornice diventa quella di sempre e la pagina non si rimonta: il campo è lo stesso nodo, col testo scritto e col fuoco; la campanella chiede le notifiche (sprint 34 · T4.5)', async () => {
        const conta = { montaggi: 0 };
        await inDue({ subito }, <PaginaColCampo conta={conta} />);
        const [barra, nodo] = [uno('aside.zr-side'), campo()];
        nodo.value = 'UAT scritto';
        nodo.focus();

        await inDue({ subito, dopo }, <PaginaColCampo conta={conta} />);

        expect(etichette()).toContain('CRM');
        expect(uno('aside.zr-side')).toBe(barra);
        expect(campo()).toBe(nodo);
        expect([campo().value, document.activeElement === nodo, conta.montaggi]).toStrictEqual(['UAT scritto', true, 1]);
        expect(sopraLaPagina()).toBeNull();
        expect(uno('.zr-bell')?.textContent).toContain('7');
        await clic(uno('.zr-bell'));
        await scrivi('uat');
        expect(richieste()).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/ricerca {"q":"uat"}']);
    });

    it.each(['it', 'es', 'en'])('con `dopo` non letto, nella lingua "%s", la cornice resta ridotta con l\'avviso «Zeiras non risponde» sopra la pagina, senza pulsante; la campanella dice il suo testo; il testo scritto nel campo resta, e niente parla di documenti (sprint 34 · T4.6)', async (lingua) => {
        const conta = { montaggi: 0 };
        await inDue({ subito: { ...subito, lingua } }, <PaginaColCampo conta={conta} />);
        const nodo = campo();
        nodo.value = 'UAT scritto';

        await inDue({ subito: { ...subito, lingua }, dopo: { non_letti: true } }, <PaginaColCampo conta={conta} />);
        const t = testi(lingua);

        expect(sopraLaPagina()?.textContent).toContain(t.downTitle);
        expect(sopraLaPagina()?.textContent).toContain(t.downText);
        expect(sopraLaPagina()?.querySelector('button')).toBeNull();
        expect(etichette()).not.toContain('CRM');
        expect([campo() === nodo, campo().value, conta.montaggi]).toStrictEqual([true, 'UAT scritto', 1]);
        await clic(uno('.zr-bell'));
        const nelPannello = uno('.zr-notif')?.textContent;
        expect(nelPannello).toContain(t.downOff);
        await scrivi('uat');
        expect(sottoLaRicerca()).toStrictEqual([t.downOff]);
        expect(richieste()).toStrictEqual([]);
        expect(`${sopraLaPagina()?.textContent} ${nelPannello} ${sottoLaRicerca().join(' ')}`).not.toMatch(/document/i);
    });

    it('con `dopo` che dice `accettazione_richiesta` lo stato ridotto è quello di sempre, con il suo avviso e il suo pulsante, e non quello di «Zeiras non risponde» (sprint 34 · T4.7)', async () => {
        await inDue({ subito, dopo: { prodotti: [], aziende: [], non_lette: 0, aggiornati_il: dopo.aggiornati_il, accettazione_richiesta: true } }, <PaginaA />);
        const t = testi('it');

        expect(sopraLaPagina()?.textContent).toContain(t.acceptanceTitle);
        expect(sopraLaPagina()?.querySelector('button')?.textContent).toBe(t.acceptanceAction);
        expect(contenitore.textContent).not.toContain(t.downTitle);
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="alert"]')?.textContent).toContain(t.acceptanceOff);
    });

    it('alla visita dopo, mentre il `dopo` nuovo non è ancora arrivato, la cornice tiene i dati che ha di quel workspace: i moduli restano; in un altro workspace riparte ridotta (sprint 34 · T4.5)', async () => {
        await inDue({ subito, dopo }, <PaginaA key="1" />);
        expect(etichette()).toContain('CRM');

        await inDue({ subito }, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')).not.toBeNull();
        expect(etichette()).toContain('CRM');

        await inDue({ subito: { ...subito, workspace: datiAltroWorkspace.workspace } }, <PaginaB key="2" />);
        expect(uno('aside.zr-side')?.textContent).toContain('Vendite');
        expect(etichette()).not.toContain('CRM');
    });

    it('alla visita dopo, se il `subito` nuovo dice la stessa persona (la stessa email) con un altro nome e un\'altra lingua e il `dopo` nuovo non è ancora arrivato, nome e lingua sono quelli nuovi; moduli e non lette restano quelli tenuti (sprint 35 · T2.1; sprint 36 · T2.4)', async () => {
        const rinominata = { nome: 'Augusta King', email: dati.persona.email };
        await inDue({ subito, dopo }, <PaginaA key="1" />);
        expect(etichette()).toContain('CRM');

        await inDue({ subito: { ...subito, lingua: 'es', persona: rinominata } }, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')).not.toBeNull();
        expect(etichette()).toContain('CRM');
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([rinominata.nome, rinominata.email]);
    });

    it('alla visita dopo, se il `subito` nuovo dice un\'altra persona (un\'altra email) e il `dopo` nuovo non è ancora arrivato, la cornice è quella ridotta di un primo caricamento: nessun modulo, nessun selettore e nessun numero di non lette di chi c\'era prima, e il menu del profilo dice chi è entrato; all\'arrivo di `dopo` moduli e non lette sono i suoi (sprint 36 · T2.1, T2.3)', async () => {
        const diAltra = { ...subito, lingua: 'es', persona: altra };
        await inDue({ subito, dopo: { ...dopo, aziende } }, <PaginaA key="1" />);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-ws-switch')).not.toBeNull();
        expect(uno('.zr-bell-count')?.textContent).toBe('7');

        await inDue({ subito: diAltra }, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')).not.toBeNull();
        expect(etichette()).not.toContain('CRM');
        expect(etichette()).not.toContain('Gestión de proyectos');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([altra.nome, altra.email]);

        await inDue({ subito: diAltra, dopo: { prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:05.000000Z' } }, <PaginaB key="2" />);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        // Le sue aziende arrivano come il resto: il selettore torna, con le sue e senza quelle di chi c'era prima (R8).
        const sue = [{ id: '8', nome: 'Globex', workspace: [{ id: 'ws-8', nome: 'Ventas', slug: 'globex-ventas' }, { id: 'ws-9', nome: dati.workspace.nome, slug: dati.workspace.slug }] }];
        await inDue({ subito: diAltra, dopo: { prodotti: { pm: 'attivo' }, aziende: sue, non_lette: 2, aggiornati_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaB key="2" />);
        expect(uno('.zr-ws-switch')?.textContent).toContain('Globex');
        expect(uno('.zr-ws-switch')?.textContent).not.toContain('Acme');
    });

    it('con Indietro sulla voce della cronologia di chi c\'era prima — il suo `subito` di allora, senza `dopo` — avatar e menu del profilo dicono chi è entrato adesso, e moduli, selettore e non lette restano i suoi: niente di chi c\'era prima, né in attesa né quando arriva un `dopo` riletto (sprint 36 · T3.1, T3.2)', async () => {
        const diPrima: DatiSubito & { sessione_il: string } = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const diAdesso: DatiSubito & { sessione_il: string } = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:03.000000Z' };
        const dopoDiAdesso: DatiDopo = { prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z' };
        const nelMenu = async () => {
            if (!uno('.zr-profile-head')) {
                await clic(uno('.zr-avatar-btn'));
            }

            return tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent);
        };
        const diChiEEntrato = async () => {
            expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
            expect(await nelMenu()).toStrictEqual([altra.nome, altra.email]);
            expect(document.body.textContent).not.toContain(dati.persona.nome);
            expect(document.body.textContent).not.toContain(dati.persona.email);
            expect(etichette()).toContain('Gestión de proyectos');
            expect(uno('.zr-ws-switch')).toBeNull();
        };

        await inDue({ subito: diPrima, dopo: { ...dopo, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaA key="1" />);
        expect(uno('.zr-ws-switch')).not.toBeNull();
        await inDue({ subito: diAdesso }, <PaginaB key="2" />);
        await inDue({ subito: diAdesso, dopo: dopoDiAdesso }, <PaginaB key="2" />);
        await diChiEEntrato();
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        // Indietro: la voce della cronologia porta il `subito` di allora, e il `dopo` si richiede.
        await inDue({ subito: diPrima }, <PaginaA key="1" />);
        expect(uno('#uat-pagina-a')).not.toBeNull();
        await diChiEEntrato();
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        // Il `dopo` riletto è della sessione di adesso; il `subito` resta quello della voce.
        await inDue({ subito: diPrima, dopo: { ...dopoDiAdesso, non_lette: 3, aggiornati_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaA key="1" />);
        await diChiEEntrato();
        expect(uno('.zr-bell-count')?.textContent).toBe('3');
    });

    it('il verso in avanti resta anche coi segni: un `subito` con la sessione letta dopo e un\'altra persona la mostra da subito, e la cornice riparte ridotta senza niente di chi c\'era prima (sprint 36 · T3.3)', async () => {
        const diPrima: DatiSubito & { sessione_il: string } = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const diAdesso: DatiSubito & { sessione_il: string } = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:03.000000Z' };
        await inDue({ subito: diPrima, dopo: { ...dopo, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaA key="1" />);
        expect(uno('.zr-bell-count')?.textContent).toBe('7');

        await inDue({ subito: diAdesso }, <PaginaB key="2" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).not.toContain('CRM');
        expect(etichette()).not.toContain('Gestión de proyectos');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([altra.nome, altra.email]);
    });

    it('con Indietro sulla voce di chi c\'era prima che porta anche il suo `dopo` di allora, mentre chi è entrato aspetta ancora il suo, moduli, selettore e non lette di allora non compaiono sotto il nome di adesso, né a quel disegno né alla visita dopo; poi arrivano i suoi (sprint 36 · T6, R1)', async () => {
        const diPrima: DatiSubito & { sessione_il: string } = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const dopoDiPrima: DatiDopo = { ...dopo, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z' };
        const diAdesso: DatiSubito & { sessione_il: string } = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:03.000000Z' };
        const ridottaDiChiEEntrato = () => {
            expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
            expect(document.body.textContent).not.toContain(dati.persona.nome);
            expect(document.body.textContent).not.toContain(dati.persona.email);
            expect(etichette()).not.toContain('CRM');
            expect(uno('.zr-ws-switch')).toBeNull();
            expect(uno('.zr-bell-count')).toBeNull();
        };
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-ws-switch')).not.toBeNull();
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        await inDue({ subito: diAdesso }, <PaginaB key="2" />);
        ridottaDiChiEEntrato();

        // Indietro prima che il `dopo` di chi è entrato arrivi: la voce ha già il suo `dopo`, e Inertia non lo richiede.
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        expect(uno('#uat-pagina-a')).not.toBeNull();
        ridottaDiChiEEntrato();

        // Avanti, ancora in attesa: fra i dati tenuti non c'è niente di chi c'era prima.
        await inDue({ subito: { ...diAdesso } }, <PaginaB key="2" />);
        ridottaDiChiEEntrato();

        await inDue({ subito: diAdesso, dopo: { prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z' } }, <PaginaB key="2" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
    });

    it('chi è entrato è ancora in attesa e torna con Indietro su una voce di prima senza `dopo`: quando arriva il `dopo` riletto la cornice mostra i suoi dati; e una voce che porta un `dopo` riletto prima non rimette i dati più vecchi al posto di quelli che la cornice ha (sprint 36 · T6, seconda lettura, N1 e N3)', async () => {
        const diPrima: DatiSubito & { sessione_il: string } = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const diAdesso: DatiSubito & { sessione_il: string } = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:03.000000Z' };
        const riletto: DatiDopo = { prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z' };
        await inDue({ subito: diPrima, dopo: { ...dopo, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaA key="1" />);
        await inDue({ subito: diAdesso }, <PaginaB key="2" />);

        // Indietro su una voce lasciata prima che il suo `dopo` arrivasse: Inertia lo richiede, e quello riletto è di chi è entrato.
        await inDue({ subito: diPrima }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(uno('.zr-bell-count')).toBeNull();
        await inDue({ subito: diPrima, dopo: riletto }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        // Un'altra voce di prima, riletta dopo; poi di nuovo la prima, che ora porta il `dopo` riletto allora: restano i dati più recenti.
        await inDue({ subito: { ...diPrima, sessione_il: '2026-10-13T07:59:00.000000Z' }, dopo: { ...riletto, non_lette: 5, aggiornati_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaB key="2" />);
        expect(uno('.zr-bell-count')?.textContent).toBe('5');
        await inDue({ subito: diPrima, dopo: riletto }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(uno('.zr-bell-count')?.textContent).toBe('5');
    });

    it('una voce lasciata prima che il suo `dopo` arrivasse e riletta da un\'altra persona porta il `dopo` di questa, che dice di chi è: quando chi c\'era torna e, in attesa su una pagina sua, fa Indietro su quella voce, a schermo restano il suo nome e niente dell\'altra — moduli, selettore, non lette —, né a quel disegno né alle visite dopo (sprint 37 · T2.1)', async () => {
        const allora: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const diAltra: DatiSubito = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:03.000000Z' };
        // Il `dopo` che l'altra persona ha riletto sulla voce di allora: la parte server dice di chi è, e quando l'ha letta.
        const rilettoDaAltra: DatiDopo = { lingua: 'es', persona: altra, workspace: subito.workspace, prodotti: { pm: 'attivo' }, aziende, non_lette: 2, aggiornati_il: '2026-10-13T08:00:05.000000Z', sessione_il: '2026-10-13T08:00:05.000000Z' };
        const tornata: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:08.000000Z' };
        const avatar = () => uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label');
        const nienteDiAltra = () => {
            expect(avatar()).toBe(dati.persona.nome);
            expect(document.body.textContent).not.toContain(altra.nome);
            expect(document.body.textContent).not.toContain(altra.email);
            expect(etichette()).not.toContain('Gestión de proyectos');
        };
        await inDue({ subito: allora }, <PaginaA key="1" />);
        const inAttesa = etichette();
        await inDue({ subito: diAltra }, <PaginaB key="2" />);

        // Indietro dell'altra persona sulla voce lasciata senza `dopo`: Inertia lo richiede, ed è il suo.
        await inDue({ subito: allora }, <PaginaA key="1" />);
        await inDue({ subito: allora, dopo: rilettoDaAltra }, <PaginaA key="1" />);
        expect(avatar()).toBe(altra.nome);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        // La sessione torna a chi c'era: apre una pagina e, prima che il suo `dopo` arrivi, torna con Indietro su quella voce.
        await inDue({ subito: tornata }, <PaginaB key="3" />);
        nienteDiAltra();
        await inDue({ subito: allora, dopo: rilettoDaAltra }, <PaginaA key="1" />);
        expect(uno('#uat-pagina-a')).not.toBeNull();
        nienteDiAltra();
        expect([etichette(), uno('.zr-ws-switch'), uno('.zr-bell-count')]).toStrictEqual([inAttesa, null, null]);

        // Alle visite dopo: Avanti ancora in attesa, poi i suoi dati, poi di nuovo Indietro su quella voce.
        await inDue({ subito: { ...tornata } }, <PaginaB key="3" />);
        nienteDiAltra();
        expect([etichette(), uno('.zr-ws-switch'), uno('.zr-bell-count')]).toStrictEqual([inAttesa, null, null]);
        await inDue({ subito: tornata, dopo: { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:09.000000Z', sessione_il: '2026-10-13T08:00:09.000000Z' } }, <PaginaB key="3" />);
        nienteDiAltra();
        expect([etichette().includes('CRM'), uno('.zr-bell-count')?.textContent]).toStrictEqual([true, '7']);
        await inDue({ subito: allora, dopo: rilettoDaAltra }, <PaginaA key="1" />);
        nienteDiAltra();
        expect([etichette().includes('CRM'), uno('.zr-ws-switch'), uno('.zr-bell-count')?.textContent]).toStrictEqual([true, null, '7']);
    });

    it('in una scheda ferma su una pagina di una persona, quando la sessione è passata a un\'altra e si rilegge il solo `dopo`, che dice di chi è, la cornice diventa quella di chi è entrato — nome, lingua e i suoi dati —, e l\'elenco delle notifiche, i risultati e la parola di chi c\'era prima non restano (sprint 37 · T2.2)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta(indirizzo === '/cornice/notifiche' ? { data: notificheDelServer } : { data: risultatiDelServer, workspace: dati.workspace.slug })));
        const ferma: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const suo: DatiDopo = { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        const diPrima = ['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche'];
        await inDue({ subito: ferma, dopo: suo }, <PaginaA key="1" />);
        await scrivi('uat');
        expect(titoliDellaRicerca()).toStrictEqual(['UAT Lancio Q1']);
        await clic(uno('.zr-bell'));
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(diPrima);

        // La scheda non visita niente: il `subito` resta quello di allora, e il `dopo` riletto è di chi è entrato da un'altra scheda.
        await inDue({ subito: ferma, dopo: { lingua: 'es', persona: altra, workspace: subito.workspace, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:05.000000Z', sessione_il: '2026-10-13T08:00:05.000000Z' } }, <PaginaA key="1" />);
        await act(giro);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(document.body.textContent).not.toContain(dati.persona.nome);
        expect(document.body.textContent).not.toContain(dati.persona.email);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('');
        expect(uno('.zr-search-panel')).toBeNull();
        expect(uno('.zr-notif')).toBeNull();
        expect(richieste()).toStrictEqual(diPrima);

        // I risultati di prima non sono rimasti nemmeno fuori dallo schermo, e la campanella chiede l'elenco di chi è entrato.
        await scrivi('ua', 0);
        expect(uno('.zr-search-panel')).not.toBeNull();
        expect(titoliDellaRicerca()).toStrictEqual([]);
        await clic(uno('.zr-bell'));
        expect(richieste()).toStrictEqual([...diPrima, 'GET /cornice/notifiche']);
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([altra.nome, altra.email]);
    });

    it('quando la pagina rilegge il solo `subito` e la sessione è passata a un\'altra persona, il `dopo` rimasto — di chi c\'era prima, e più vecchio — non vale: nome, email e lingua sono di chi è entrato, la cornice è in attesa e di chi c\'era prima non resta niente, né aziende, né workspace, né moduli, né non lette, né nel menu del profilo; poi arriva il suo `dopo` e la cornice è la sua per intero (sprint 38 · T2.1, T2.2)', async () => {
        const suo: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const letto: DatiDopo = { ...dopo, aziende, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        const diAltra: DatiSubito = { lingua: 'es', persona: altra, workspace: { nome: 'Ventas', slug: 'globex-ventas' }, sessione_il: '2026-10-13T08:00:05.000000Z' };
        const inAttesaDiChiEEntrato = () => {
            expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
            expect(document.body.textContent).not.toContain(dati.persona.nome);
            expect(document.body.textContent).not.toContain(dati.persona.email);
            expect(document.body.textContent).not.toContain('Acme');
            expect(uno('aside.zr-side')?.textContent).toContain('Ventas');
            expect(uno('aside.zr-side')?.textContent).not.toContain(dati.workspace.nome);
            expect(etichette()).toContain(testi('es').dashboard);
            expect(etichette()).not.toContain('CRM');
            expect(etichette()).not.toContain('Gestión de proyectos');
            expect(uno('.zr-ws-switch')).toBeNull();
            expect(uno('.zr-bell-count')).toBeNull();
        };
        // «A quel disegno e ai successivi» (sprint 38 · T5, R9 della review): dal ricaricamento parziale in poi la pagina guarda
        // il DOM a ogni suo disegno, appena scritto e prima di ogni effetto. Di chi c'era prima niente, nemmeno per un disegno.
        const daQui = { guarda: false };
        const diChiCEra: boolean[] = [];
        function PaginaCheGuarda() {
            useLayoutEffect(() => {
                if (daQui.guarda) {
                    const testo = document.body.textContent ?? '';
                    diChiCEra.push(testo.includes(dati.persona.nome) || testo.includes('Acme') || uno('.zr-bell-count') !== null || etichette().includes('CRM'));
                }
            });

            return <PaginaA />;
        }
        await inDue({ subito: suo, dopo: letto }, <PaginaCheGuarda key="1" />);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-ws-switch')?.textContent).toContain('Acme');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');

        // Un ricaricamento parziale del solo `subito` (`only: ['subito']`): il `dopo` fra le props resta quello di prima.
        daQui.guarda = true;
        await inDue({ subito: diAltra, dopo: letto }, <PaginaCheGuarda key="1" />);
        inAttesaDiChiEEntrato();
        await act(giro);
        inAttesaDiChiEEntrato();
        daQui.guarda = false;
        expect(diChiCEra.length).toBeGreaterThan(0);
        expect(diChiCEra).not.toContain(true);
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="status"]')?.textContent).toBe(testi('es').loading);
        await clic(uno('.zr-avatar-btn'));
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([altra.nome, altra.email]);
        inAttesaDiChiEEntrato();

        await inDue({ subito: diAltra, dopo: { lingua: 'es', persona: altra, workspace: diAltra.workspace, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:06.000000Z', sessione_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaCheGuarda key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
        expect(document.body.textContent).not.toContain(dati.persona.nome);
    });

    it('nello stesso workspace, per più passaggi e col menu del profilo aperto: a ogni `subito` riletto da solo che dice un\'altra persona la cornice è la sua e in attesa, senza niente di chi c\'era prima, e all\'arrivo del suo `dopo` è la sua per intero — da una persona all\'altra e ritorno (sprint 38 · T2.1, T2.2)', async () => {
        const conta = { montaggi: 0 };
        const diAda = (il: string): DatiSubito => ({ ...subito, sessione_il: `2026-10-13T08:00:${il}.000000Z` });
        const diAugusta = (il: string): DatiSubito => ({ ...subito, lingua: 'es', persona: altra, sessione_il: `2026-10-13T08:00:${il}.000000Z` });
        const lettoDaAda = (il: string): DatiDopo => ({ ...dopo, aziende, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: `2026-10-13T08:00:${il}.000000Z`, sessione_il: `2026-10-13T08:00:${il}.000000Z` });
        const lettoDaAugusta: DatiDopo = { lingua: 'es', persona: altra, workspace: subito.workspace, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:08.000000Z', sessione_il: '2026-10-13T08:00:08.000000Z' };
        const nelProfilo = () => tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent);
        const inAttesa = (chi: { nome: string; email: string }, nonChi: { nome: string; email: string }) => {
            expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(chi.nome);
            expect(document.body.textContent).not.toContain(nonChi.nome);
            expect(document.body.textContent).not.toContain(nonChi.email);
            expect(etichette()).not.toContain('CRM');
            expect(etichette()).not.toContain('Gestión de proyectos');
            expect(etichette()).not.toContain('Project Management');
            expect(uno('.zr-ws-switch')).toBeNull();
            expect(uno('.zr-bell-count')).toBeNull();
        };
        await inDue({ subito: diAda('00'), dopo: lettoDaAda('01') }, <PaginaColCampo conta={conta} />);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        await clic(uno('.zr-avatar-btn'));
        expect(nelProfilo()).toStrictEqual([dati.persona.nome, dati.persona.email]);

        // Primo passaggio: entra Augusta, la pagina rilegge il solo `subito`.
        await inDue({ subito: diAugusta('05'), dopo: lettoDaAda('01') }, <PaginaColCampo conta={conta} />);
        inAttesa(altra, dati.persona);
        await clic(uno('.zr-avatar-btn'));
        expect(nelProfilo()).toStrictEqual([altra.nome, altra.email]);
        inAttesa(altra, dati.persona);

        // Lo rilegge ancora, col menu aperto: il `dopo` di Ada è sempre lì, sempre più vecchio.
        await inDue({ subito: diAugusta('07'), dopo: lettoDaAda('01') }, <PaginaColCampo conta={conta} />);
        await act(giro);
        inAttesa(altra, dati.persona);

        // Arriva il `dopo` di Augusta: la cornice è la sua per intero, senza un ricaricamento.
        await inDue({ subito: diAugusta('07'), dopo: lettoDaAugusta }, <PaginaColCampo conta={conta} />);
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
        expect(document.body.textContent).not.toContain(dati.persona.nome);

        // Secondo passaggio, il ritorno: rientra Ada, e sotto il suo `subito` resta il `dopo` di Augusta.
        await inDue({ subito: diAda('10'), dopo: lettoDaAugusta }, <PaginaColCampo conta={conta} />);
        inAttesa(dati.persona, altra);
        await clic(uno('.zr-avatar-btn'));
        expect(nelProfilo()).toStrictEqual([dati.persona.nome, dati.persona.email]);
        inAttesa(dati.persona, altra);

        await inDue({ subito: diAda('10'), dopo: lettoDaAda('11') }, <PaginaColCampo conta={conta} />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-ws-switch')?.textContent).toContain('Acme');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        expect(document.body.textContent).not.toContain(altra.nome);
    });

    it('per la stessa persona un `subito` riletto più recente del suo `dopo` non mette la cornice in attesa e non rimonta la pagina: moduli, aziende e non lette restano quelli del `dopo`; anche al primo disegno (sprint 38 · T2.3)', async () => {
        const conta = { montaggi: 0 };
        const suo: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const letto: DatiDopo = { ...dopo, aziende, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        const riletto: DatiSubito = { ...subito, lingua: 'es', persona: { nome: 'Augusta King', email: dati.persona.email }, sessione_il: '2026-10-13T08:00:05.000000Z' };
        const quellaDiSempre = () => {
            expect(etichette()).toContain('CRM');
            expect(uno('.zr-ws-switch')?.textContent).toContain('Acme');
            expect(uno('.zr-bell-count')?.textContent).toBe('7');
            expect(sopraLaPagina()).toBeNull();
        };
        await inDue({ subito: suo, dopo: letto }, <PaginaColCampo conta={conta} />);
        const [barra, nodo] = [uno('aside.zr-side'), campo()];
        nodo.value = 'UAT scritto';
        nodo.focus();
        quellaDiSempre();

        await inDue({ subito: riletto, dopo: letto }, <PaginaColCampo conta={conta} />);
        await act(giro);

        quellaDiSempre();
        expect(uno('aside.zr-side')).toBe(barra);
        expect([campo() === nodo, campo().value, document.activeElement === nodo, conta.montaggi]).toStrictEqual([true, 'UAT scritto', true, 1]);
        // Nome e lingua: come oggi, quelli che dice il `dopo` (sta sopra `subito`, con tutto ciò che porta), finché non è riletto.
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
        expect(etichette()).toContain('Project Management');
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="status"]')?.textContent ?? '').not.toBe(testi('it').loading);

        // Al primo disegno, senza niente di tenuto: lo stesso.
        await mostra(<></>);
        await inDue({ subito: riletto, dopo: letto }, <PaginaColCampo conta={{ montaggi: 0 }} />);
        quellaDiSempre();
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
    });

    it('un `dopo` che non dice di chi è, o un segno che manca da una parte, vale come prima sotto il `subito` di un\'altra persona: il confronto si fa solo fra due segni e due email (sprint 38 · T2.4)', async () => {
        const diAltra: DatiSubito = { ...subito, lingua: 'es', persona: altra, sessione_il: '2026-10-13T08:00:05.000000Z' };
        const letto: DatiDopo = { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };

        // Una parte server di prima della `v2.4.0`: `dopo` non dice né di chi è né la sessione. Sta sotto il nome di `subito`.
        await inDue({ subito: diAltra, dopo }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).toContain('CRM');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');

        // `dopo` dice di chi è ma non quando: vale lui.
        await mostra(<></>);
        await inDue({ subito: diAltra, dopo: { ...letto, sessione_il: undefined } }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
        expect(etichette()).toContain('CRM');

        // `subito` senza il segno della sessione: vale `dopo`.
        await mostra(<></>);
        await inDue({ subito: { ...diAltra, sessione_il: undefined }, dopo: letto }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
        expect(etichette()).toContain('CRM');

        // `non_letti` (un `dopo` senza persona): la cornice ridotta di «Zeiras non risponde», sotto il nome di `subito`.
        await mostra(<></>);
        await inDue({ subito: diAltra, dopo: { non_letti: true, aggiornati_il: '2026-10-13T08:00:01.000000Z' } }, <PaginaA key="1" />);
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
        expect(etichette()).not.toContain('CRM');
        expect(contenitore.textContent).toContain(testi('es').downTitle);
    });

    it('per la stessa persona un `dopo` che dice di chi è non cambia niente: quando arriva la cornice è quella di sempre e la pagina non si rimonta — lo stesso nodo, il testo scritto, il fuoco —; se è riletto con un altro nome e un\'altra lingua la cornice li mostra, sempre senza rimontare (sprint 37 · T2.4)', async () => {
        const conta = { montaggi: 0 };
        const suo: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const letto: DatiDopo = { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        await inDue({ subito: suo }, <PaginaColCampo conta={conta} />);
        const [barra, nodo] = [uno('aside.zr-side'), campo()];
        nodo.value = 'UAT scritto';
        nodo.focus();

        await inDue({ subito: suo, dopo: letto }, <PaginaColCampo conta={conta} />);

        expect(etichette()).toContain('CRM');
        expect(uno('aside.zr-side')).toBe(barra);
        expect(campo()).toBe(nodo);
        expect([campo().value, document.activeElement === nodo, conta.montaggi]).toStrictEqual(['UAT scritto', true, 1]);
        expect(sopraLaPagina()).toBeNull();
        expect(uno('.zr-bell-count')?.textContent).toBe('7');

        // Riletto dopo (un ricaricamento del solo `dopo`): io.mostra ha dato un altro nome e un'altra lingua alla stessa email.
        await inDue({ subito: suo, dopo: { ...letto, lingua: 'es', persona: { nome: 'Augusta King', email: dati.persona.email }, non_lette: 4, aggiornati_il: '2026-10-13T08:00:06.000000Z', sessione_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaColCampo conta={conta} />);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe('Augusta King');
        expect(etichette()).toContain('Gestión de proyectos');
        expect(uno('.zr-bell-count')?.textContent).toBe('4');
        expect(uno('aside.zr-side')).toBe(barra);
        expect([campo() === nodo, campo().value, conta.montaggi]).toStrictEqual([true, 'UAT scritto', 1]);
    });

    it('fra due workspace, con Indietro su una pagina intera di chi c\'era prima la cornice resta di chi è entrato: avatar, lingua, workspace e non lette sono i suoi, niente di allora è a schermo e la cornice non si rifà, né a quel disegno né alle visite dopo (sprint 37 · T3.1)', async () => {
        const altrove = datiAltroWorkspace.workspace;
        const diPrima: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const dopoDiPrima: DatiDopo = { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        const diAdesso: DatiSubito = { lingua: 'es', persona: altra, workspace: altrove, sessione_il: '2026-10-13T08:00:03.000000Z' };
        const dopoDiAdesso: DatiDopo = { lingua: 'es', persona: altra, workspace: altrove, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z', sessione_il: '2026-10-13T08:00:04.000000Z' };
        const diChiEEntrato = () => {
            expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(altra.nome);
            expect(document.body.textContent).not.toContain(dati.persona.nome);
            expect(document.body.textContent).not.toContain(dati.persona.email);
            expect(uno('aside.zr-side')?.textContent).toContain(altrove.nome);
            expect(uno('aside.zr-side')?.textContent).not.toContain('Acme');
            expect(etichette()).toContain('Gestión de proyectos');
            expect([uno('.zr-ws-switch'), uno('.zr-bell-count')?.textContent]).toStrictEqual([null, '2']);
        };
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        expect([uno('.zr-ws-switch') !== null, uno('.zr-bell-count')?.textContent]).toStrictEqual([true, '7']);
        await inDue({ subito: diAdesso, dopo: dopoDiAdesso }, <PaginaB key="2" />);
        diChiEEntrato();
        const barra = uno('aside.zr-side');

        // Indietro sulla voce intera di chi c'era prima, in un altro workspace.
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        expect(uno('#uat-pagina-a')).not.toBeNull();
        diChiEEntrato();
        expect(uno('aside.zr-side')).toBe(barra);

        // Avanti, e di nuovo Indietro.
        await inDue({ subito: diAdesso, dopo: dopoDiAdesso }, <PaginaB key="2" />);
        diChiEEntrato();
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        diChiEEntrato();
        expect(uno('aside.zr-side')).toBe(barra);
    });

    it('fra due workspace, con Indietro su una voce di chi c\'era prima a cui manca il `dopo` la cornice resta di chi è entrato mentre Inertia lo richiede, e i dati riletti, che sono suoi, stanno sotto il suo nome: sia quando `dopo` dice di chi è, sia quando non lo dice (sprint 37 · T3.2; era il limite dei due workspace del README, sprint 36 · T6, N4)', async () => {
        const altrove = datiAltroWorkspace.workspace;
        const diPrima: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const diAdesso: DatiSubito = { lingua: 'es', persona: altra, workspace: altrove, sessione_il: '2026-10-13T08:00:03.000000Z' };
        const dopoDiAdesso: DatiDopo = { lingua: 'es', persona: altra, workspace: altrove, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z', sessione_il: '2026-10-13T08:00:04.000000Z' };
        const avatar = () => uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label');
        const suoi = (nonLette: string) => {
            expect(avatar()).toBe(altra.nome);
            expect(document.body.textContent).not.toContain(dati.persona.nome);
            expect(uno('aside.zr-side')?.textContent).toContain(altrove.nome);
            expect(uno('.zr-bell-count')?.textContent).toBe(nonLette);
        };
        await inDue({ subito: diPrima }, <PaginaA key="1" />);
        await inDue({ subito: diAdesso, dopo: dopoDiAdesso }, <PaginaB key="2" />);
        suoi('2');

        // Indietro: la voce porta il solo `subito` di allora, e Inertia richiede il `dopo`.
        await inDue({ subito: diPrima }, <PaginaA key="1" />);
        expect(uno('#uat-pagina-a')).not.toBeNull();
        suoi('2');
        await inDue({ subito: diPrima, dopo: { ...dopoDiAdesso, non_lette: 5, aggiornati_il: '2026-10-13T08:00:06.000000Z', sessione_il: '2026-10-13T08:00:06.000000Z' } }, <PaginaA key="1" />);
        suoi('5');

        // Lo stesso con un `dopo` che non dice di chi è (composto a mano, o di una voce salvata prima della `v2.4.0`).
        await inDue({ subito: { ...diAdesso, sessione_il: '2026-10-13T08:00:07.000000Z' }, dopo: { ...dopoDiAdesso, non_lette: 5, aggiornati_il: '2026-10-13T08:00:08.000000Z', sessione_il: '2026-10-13T08:00:08.000000Z' } }, <PaginaB key="2" />);
        await inDue({ subito: { ...diPrima, sessione_il: '2026-10-13T07:59:00.000000Z' } }, <PaginaA key="3" />);
        suoi('5');
        await inDue({ subito: { ...diPrima, sessione_il: '2026-10-13T07:59:00.000000Z' }, dopo: { workspace: altrove, prodotti: { pm: 'attivo' }, non_lette: 6, aggiornati_il: '2026-10-13T08:00:09.000000Z' } }, <PaginaA key="3" />);
        suoi('6');
    });

    it('per la stessa persona fra due workspace niente cambia: con Indietro su una pagina di un altro workspace la cornice è quella di quel workspace, coi suoi dati, e si rifà (sprint 37 · T3.3)', async () => {
        const altrove = datiAltroWorkspace.workspace;
        const diPrima: DatiSubito = { ...subito, sessione_il: '2026-10-13T08:00:00.000000Z' };
        const dopoDiPrima: DatiDopo = { ...dopo, lingua: 'it', persona: dati.persona, workspace: subito.workspace, aziende, aggiornati_il: '2026-10-13T08:00:01.000000Z', sessione_il: '2026-10-13T08:00:01.000000Z' };
        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);
        await inDue({ subito: { ...diPrima, workspace: altrove, sessione_il: '2026-10-13T08:00:03.000000Z' }, dopo: { lingua: 'it', persona: dati.persona, workspace: altrove, prodotti: { pm: 'attivo' }, non_lette: 2, aggiornati_il: '2026-10-13T08:00:04.000000Z', sessione_il: '2026-10-13T08:00:04.000000Z' } }, <PaginaB key="2" />);
        expect([uno('aside.zr-side')?.textContent?.includes(altrove.nome), uno('.zr-ws-switch'), uno('.zr-bell-count')?.textContent]).toStrictEqual([true, null, '2']);
        const barra = uno('aside.zr-side');

        await inDue({ subito: diPrima, dopo: dopoDiPrima }, <PaginaA key="1" />);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(dati.persona.nome);
        expect(uno('aside.zr-side')).not.toBe(barra);
        expect(uno('aside.zr-side')?.textContent).toContain(dati.workspace.nome);
        expect([uno('.zr-ws-switch') !== null, etichette().includes('CRM'), uno('.zr-bell-count')?.textContent]).toStrictEqual([true, true, '7']);
    });

    // Sprint 37 · T6 (review della PR #70: R1 = S1, R2 = S2, R3, R5, R12): più di un Indietro fra due persone e due workspace.
    // Una voce della cronologia: il `subito` di una persona su un workspace al secondo detto, col `dopo` letto un secondo dopo.
    const voce = (persona: DatiSubito['persona'], workspace: DatiSubito['workspace'], secondo: number, nonLette: number): { subito: DatiSubito; dopo: DatiDopo } => {
        const il = (quando: number) => `2026-10-13T08:00:${String(quando).padStart(2, '0')}.000000Z`;

        return { subito: { lingua: 'it', persona, workspace, sessione_il: il(secondo) }, dopo: { lingua: 'it', persona, workspace, prodotti: { pm: 'attivo' }, non_lette: nonLette, aggiornati_il: il(secondo + 1), sessione_il: il(secondo + 1) } };
    };
    // La stessa voce con la `cornice` intera (un dato solo): il suo segno è quello della lettura.
    const intera = (persona: DatiSubito['persona'], workspace: DatiSubito['workspace'], secondo: number, nonLette: number): { cornice: DatiDellaCornice } => ({
        cornice: { lingua: 'it', persona, workspace, prodotti: { pm: 'attivo' }, non_lette: nonLette, aggiornati_il: `2026-10-13T08:00:${String(secondo).padStart(2, '0')}.000000Z` },
    });
    // Chi c'è a schermo: l'avatar, il workspace della barra, le non lette, e nome ed email nel menu del profilo, aperto.
    const aSchermo = async (persona: DatiSubito['persona'], workspace: DatiSubito['workspace'], nonLette: string, nonSuo: DatiSubito['workspace']) => {
        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe(persona.nome);
        expect(uno('aside.zr-side')?.textContent).toContain(workspace.nome);
        expect(uno('aside.zr-side')?.textContent).not.toContain(nonSuo.nome);
        expect(uno('.zr-bell-count')?.textContent).toBe(nonLette);
        if (!uno('.zr-profile-head')) {
            await clic(uno('.zr-avatar-btn'));
        }
        expect(tutti('.zr-profile-head > span:not(.zr-avatar) > *').map((riga) => riga.textContent)).toStrictEqual([persona.nome, persona.email]);
    };

    it.each([
        ['coi due dati', voce],
        ['con la `cornice` intera', intera],
    ])('con tre voci, due Indietro di fila non riportano chi c\'era prima: dopo una pagina sua più vecchia sullo stesso workspace, quella su un altro workspace non rifà la cornice coi suoi dati (%s; sprint 37 · T6, R1)', async (_come, fai) => {
        const [qui, altrove] = [dati.workspace, datiAltroWorkspace.workspace];
        const [q, r, s] = [fai(altra, altrove, 0, 1), fai(altra, qui, 10, 2), fai(dati.persona, qui, 20, 3)];
        await inDue(q, <PaginaA key="1" />);
        await inDue(r, <PaginaB key="2" />);
        await inDue(s, <PaginaA key="3" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        const barra = uno('aside.zr-side');

        // Indietro sulla voce di chi c'era prima sullo stesso workspace, poi su quella dell'altro workspace.
        await inDue(r, <PaginaB key="2" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        await inDue(q, <PaginaA key="1" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        expect(uno('aside.zr-side')).toBe(barra);

        // Avanti fino in fondo.
        await inDue(r, <PaginaB key="2" />);
        await inDue(s, <PaginaA key="3" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        expect(uno('aside.zr-side')).toBe(barra);
    });

    it('chi è mostrato non torna indietro: dopo Indietro su una pagina sua più vecchia, Avanti sulla voce di un\'altra persona in un altro workspace non rifà la cornice per lei (sprint 37 · T6, R2)', async () => {
        const [qui, altrove] = [dati.workspace, datiAltroWorkspace.workspace];
        const [c1, o2, c3] = [voce(dati.persona, qui, 0, 1), voce(altra, altrove, 10, 2), voce(dati.persona, qui, 20, 3)];
        await inDue(c1, <PaginaA key="1" />);
        await inDue(o2, <PaginaB key="2" />);
        await inDue(c3, <PaginaA key="3" />);

        await inDue(o2, <PaginaB key="2" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        await inDue(c1, <PaginaA key="1" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        await inDue(o2, <PaginaB key="2" />);
        await aSchermo(dati.persona, qui, '3', altrove);
    });

    it.each([
        ['coi due dati', voce],
        ['con la `cornice` intera', intera],
    ])('lo stesso quando la pagina sua più vecchia è di un altro workspace e la cornice si è rifatta lì: Avanti sulla voce di un\'altra persona in quel workspace non la mostra (%s; sprint 37 · T6, S2)', async (_come, fai) => {
        const [qui, altrove] = [dati.workspace, datiAltroWorkspace.workspace];
        const [y1, x2, y3] = [fai(dati.persona, altrove, 0, 1), fai(altra, altrove, 10, 2), fai(dati.persona, qui, 20, 3)];
        await inDue(y1, <PaginaA key="1" />);
        await inDue(x2, <PaginaB key="2" />);
        await inDue(y3, <PaginaA key="3" />);

        await inDue(x2, <PaginaB key="2" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        await inDue(y1, <PaginaA key="1" />);
        await aSchermo(dati.persona, altrove, '1', qui);
        await inDue(x2, <PaginaB key="2" />);
        await aSchermo(dati.persona, altrove, '1', qui);
    });

    it('una pagina sua resta sua: dopo Indietro su una voce di un\'altra persona, Indietro su una pagina sua di un altro workspace mostra la cornice di quel workspace, coi suoi dati (sprint 37 · T6, R3)', async () => {
        const [qui, altrove] = [dati.workspace, datiAltroWorkspace.workspace];
        const [a0, b1, a2] = [voce(dati.persona, altrove, 0, 1), voce(altra, qui, 10, 2), voce(dati.persona, qui, 20, 3)];
        await inDue(a0, <PaginaA key="1" />);
        await inDue(b1, <PaginaB key="2" />);
        await inDue(a2, <PaginaA key="3" />);

        await inDue(b1, <PaginaB key="2" />);
        await aSchermo(dati.persona, qui, '3', altrove);
        await inDue(a0, <PaginaA key="1" />);
        await aSchermo(dati.persona, altrove, '1', qui);
        expect(uno('#uat-pagina-a')).not.toBeNull();
    });

    it('su una pagina sua più vecchia di un altro workspace il nome e la lingua restano quelli di adesso, non quelli di allora (sprint 37 · T6)', async () => {
        const [qui, altrove] = [dati.workspace, datiAltroWorkspace.workspace];
        const allora = voce(dati.persona, altrove, 0, 1);
        const adesso = voce({ nome: 'Ada King', email: dati.persona.email }, qui, 20, 3);
        await inDue(allora, <PaginaA key="1" />);
        await inDue({ subito: { ...adesso.subito, lingua: 'es' }, dopo: { ...adesso.dopo, lingua: 'es' } }, <PaginaB key="2" />);

        await inDue(allora, <PaginaA key="1" />);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe('Ada King');
        expect(etichette()).toContain('Gestión de proyectos');
        expect([uno('aside.zr-side')?.textContent?.includes(altrove.nome), uno('.zr-bell-count')?.textContent]).toStrictEqual([true, '1']);
    });

    it('quando il `subito` nuovo dice un\'altra persona non restano l\'elenco delle notifiche del pannello aperto, i risultati della ricerca e la parola di chi c\'era prima: il campo è vuoto, i pannelli sono chiusi, e all\'arrivo di `dopo` non parte nessuna richiesta finché chi è entrato non cerca o non apre la campanella (sprint 36 · T2.2)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta(indirizzo === '/cornice/notifiche' ? { data: notificheDelServer } : { data: risultatiDelServer, workspace: dati.workspace.slug })));
        const diAltra = { ...subito, persona: altra };
        const diPrima = ['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche'];
        await inDue({ subito, dopo }, <PaginaA key="1" />);
        await scrivi('uat');
        expect(titoliDellaRicerca()).toStrictEqual(['UAT Lancio Q1']);
        await clic(uno('.zr-bell'));
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(diPrima);

        await inDue({ subito: diAltra }, <PaginaB key="2" />);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('');
        expect(uno('.zr-search-panel')).toBeNull();
        expect(uno('.zr-notif')).toBeNull();

        // I dati di chi è entrato arrivano: la parola di prima non parte, e nessun elenco si chiede da solo.
        await inDue({ subito: diAltra, dopo: { ...dopo, aggiornati_il: '2026-10-13T08:00:05.000000Z' } }, <PaginaB key="2" />);
        await act(giro);
        expect(richieste()).toStrictEqual(diPrima);
        expect(uno('.zr-notif')).toBeNull();

        // I risultati di prima non sono rimasti nemmeno fuori dallo schermo: scrivendo, il pannello si riapre subito, prima che la
        // cornice cerchi (i 300 ms non passano), e non ne mostra nessuno. E la campanella chiede l'elenco di chi è entrato.
        await scrivi('ua', 0);
        expect(uno('.zr-search-panel')).not.toBeNull();
        expect(titoliDellaRicerca()).toStrictEqual([]);
        await clic(uno('.zr-bell'));
        expect(richieste()).toStrictEqual([...diPrima, 'GET /cornice/notifiche']);
    });

    it('la parola che una persona ha scritto in attesa non parte quando arrivano i dati di un\'altra, e nel campo non resta (sprint 36 · T2.2)', async () => {
        const diAltra = { ...subito, persona: altra };
        await inDue({ subito }, <PaginaA key="1" />);
        await scrivi('uat');
        expect(richieste()).toStrictEqual([]);

        await inDue({ subito: diAltra }, <PaginaA key="1" />);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('');
        await inDue({ subito: diAltra, dopo }, <PaginaA key="1" />);
        await act(giro);
        expect(richieste()).toStrictEqual([]);
    });

    it('con la `cornice` intera, una visita che porta un\'altra persona sullo stesso workspace toglie l\'elenco del pannello aperto, i risultati e la parola della ricerca di chi c\'era prima, e la campanella chiede di nuovo l\'elenco (sprint 36 · T2.5)', async () => {
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta(indirizzo === '/cornice/notifiche' ? { data: notificheDelServer } : { data: risultatiDelServer, workspace: dati.workspace.slug })));
        const diPrima = ['POST /cornice/ricerca {"q":"uat"}', 'GET /cornice/notifiche'];
        await visita(dati, <PaginaA key="1" />);
        await scrivi('uat');
        expect(titoliDellaRicerca()).toStrictEqual(['UAT Lancio Q1']);
        await clic(uno('.zr-bell'));
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);

        await visita({ ...dati, persona: altra, non_lette: 1 }, <PaginaB key="2" />);
        expect(uno('#uat-pagina-b')).not.toBeNull();
        expect(uno('.zr-bell-count')?.textContent).toBe('1');
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('');
        expect(uno('.zr-search-panel')).toBeNull();
        expect(uno('.zr-notif')).toBeNull();
        expect(richieste()).toStrictEqual(diPrima);

        await scrivi('ua', 0);
        expect(uno('.zr-search-panel')).not.toBeNull();
        expect(titoliDellaRicerca()).toStrictEqual([]);
        await clic(uno('.zr-bell'));
        expect(richieste()).toStrictEqual([...diPrima, 'GET /cornice/notifiche']);
    });

    it('`DatiSubito` e `DatiDopo` escono da tutti e due gli ingressi, e sono i tipi di `subito` e `dopo` del layout (sprint 35 · T4.1)', () => {
        expectTypeOf<DatiSubito>().toEqualTypeOf<NonNullable<LayoutDellaCorniceProps['subito']>>();
        expectTypeOf<DatiDopo>().toEqualTypeOf<NonNullable<LayoutDellaCorniceProps['dopo']>>();
        expectTypeOf<DatiSubitoDiApp>().toEqualTypeOf<DatiSubito>();
        expectTypeOf<DatiDopoDiApp>().toEqualTypeOf<DatiDopo>();
    });

    it('chi manda `cornice` non cambia: vale lei anche se ci sono `subito` e `dopo`; senza `cornice` e senza `subito` la pagina si vede da sola (sprint 34 · T4.8)', async () => {
        await inDue({ cornice: datiAltroWorkspace, subito, dopo: { non_letti: true } }, <PaginaA />);
        expect(uno('aside.zr-side')?.textContent).toContain('Vendite');
        expect(sopraLaPagina()).toBeNull();
        expect(etichette()).toContain('CRM');

        await inDue({ cornice: null, subito: null, dopo }, <PaginaA />);
        expect(uno('aside.zr-side')).toBeNull();
        expect(uno('#uat-pagina-a')).not.toBeNull();
    });
});
