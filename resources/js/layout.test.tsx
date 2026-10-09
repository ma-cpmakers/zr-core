import { act, useEffect, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutDellaCornice, useCornice, type DatiDellaCornice, type GruppoDiVoci, type LayoutDellaCorniceProps } from './index';
import { testi } from './lingue';

// Sprint 9 · T1 e T2 (voce #1398). `LayoutDellaCornice` reso in un DOM finto come lo rende Inertia: a ogni visita lo stesso
// layout, la pagina con una `key` nuova e i dati della parte server di quella pagina (`cornice`). La cornice resta montata
// mentre la pagina cambia, e la pagina le dà ciò che sa solo lei con `useCornice`. Con Inertia vera, nel browser, lo prova la
// pagina di prova del layout.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile' },
    non_lette: 7,
};
/** I dati della pagina dopo: un altro oggetto, un altro workspace, un altro numero di non lette. */
const datiDopo: DatiDellaCornice = { ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' }, non_lette: 3 };
const esciSenzaEffetto = () => {};
const percorso = [{ label: 'Marketing', href: 'https://board.zeiras.com/w/acme-marketing' }, { label: 'Q4 launch' }];
/** Le notifiche come le dà GET /cornice/notifiche, dalla più recente. */
const notificheDelServer = [
    { id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm' },
    { id: 'uat-n40', creata_il: '2026-10-05T12:00:00Z', letta: true, app: null },
];

function PaginaA() {
    return <p id="uat-pagina-a">UAT pagina A</p>;
}

function PaginaB() {
    return <p id="uat-pagina-b">UAT pagina B</p>;
}

/** Le voci di un prodotto: nessuna ha un indirizzo, e al clic chiamano `onNavigate`. */
const voci: GruppoDiVoci[] = [{ group: 'UAT gruppo', items: [{ id: 'uat-a', label: 'UAT A', icon: 'board' }, { id: 'uat-b', label: 'UAT B', icon: 'list' }] }];

/** Una pagina che dà alla cornice ciò che riceve. */
function PaginaCheDa({ cose }: { cose: Parameters<typeof useCornice>[0] }) {
    useCornice(cose);

    return <p id="uat-pagina-che-da">UAT pagina che dà</p>;
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
    // Le rotte della cornice: le notifiche qui sopra, e nessun risultato della ricerca.
    vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => risposta({ data: indirizzo === '/cornice/notifiche' ? notificheDelServer : [] })));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    // Nessun errore in console, nemmeno un avviso di React (T1.3).
    expect(console.error).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

/** Scrive una parola nel campo della ricerca, come una persona, e lascia passare i 300 ms dopo cui l'`AppShell` chiama `onSearch`. */
async function scrivi(parola: string): Promise<void> {
    const campo = uno('.zr-search input') as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, parola);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);
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

/** Gli indirizzi delle richieste partite, nell'ordine. */
const richieste = () => vi.mocked(fetch).mock.calls.map(([indirizzo]) => String(indirizzo));

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
        expect(richieste()).toStrictEqual(['/cornice/ricerca?q=uat', '/cornice/notifiche']);

        // Un'altra pagina, coi dati della sua visita: un altro componente e un altro oggetto `cornice`.
        await visita(datiDopo, <PaginaB key="2" />);
        expect(uno('#uat-pagina-a')).toBeNull();
        expect(uno('#uat-pagina-b')?.textContent).toBe('UAT pagina B');
        expect(uno('aside.zr-side')).toBe(barra);
        expect(uno('header.zr-top')).toBe(topbar);
        expect((uno('.zr-search input[type=search]') as HTMLInputElement).value).toBe('uat');
        expect(tutti('.zr-notif .zr-notif-list .zr-notif-item')).toHaveLength(2);
        expect(richieste()).toStrictEqual(['/cornice/ricerca?q=uat', '/cornice/notifiche']);
    });

    it('dopo il cambio di pagina la cornice montata mostra i dati nuovi: le non lette sulla campanella e il nome del workspace in cima alla barra (sprint 9 · T1.2)', async () => {
        await visita(dati, <PaginaA key="1" />);
        const barra = uno('aside.zr-side');
        expect(uno('.zr-bell-count')?.textContent).toBe('7');
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Marketing');

        await visita(datiDopo, <PaginaB key="2" />);
        expect(uno('.zr-bell-count')?.textContent).toBe('3');
        expect(uno('aside.zr-side .zr-workspace')?.textContent).toBe('Vendite');
        // È la cornice di prima coi dati nuovi, non una rifatta.
        expect(uno('aside.zr-side')).toBe(barra);
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
        await visita(dati, <PaginaA key="1" />);
        expect(contenitore.childElementCount).toBe(1);
        expect(contenitore.firstElementChild?.className).toBe('zr-shell');
        expect(uno('#uat-pagina-a')?.parentElement).toBe(uno('.zr-shell > main.zr-main'));

        await visita(dati, <PaginaA key="1" />, { crumbs: percorso });
        expect(contenitore.childElementCount).toBe(1);
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
        expect((uno('.zr-search input') as HTMLInputElement).placeholder).toBe(testi('it').searchPlaceholder);
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
