import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutDellaCornice, type DatiDellaCornice, type LayoutDellaCorniceProps } from './index';
import { testi } from './lingue';

// Sprint 9 · T1 (voce #1398). `LayoutDellaCornice` reso in un DOM finto come lo rende Inertia: a ogni visita lo stesso layout,
// la pagina con una `key` nuova e i dati della parte server di quella pagina (`cornice`). La cornice resta montata mentre la
// pagina cambia. Con Inertia vera, nel browser, lo prova la pagina di prova del layout.

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
