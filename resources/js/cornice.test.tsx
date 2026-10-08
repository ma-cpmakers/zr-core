import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconName } from '../zeiras/index';
import { Cornice } from './cornice';
import type { DatiDellaCornice } from './index';
import { testi } from './lingue';
import { Zeiras } from './zeiras';

// Sprint 1 · T6 (voce #1255), riscritto nello sprint 2 · T4 (voce #1256). La `Cornice` resa in un DOM finto coi dati della parte
// server (`Cornice::dati()`): il menu Prodotti dal registro incrociato con lo stato dei prodotti nel workspace, il pulsante del
// prodotto aperto, i testi della lingua dei dati, persona e workspace dove li mette il design system, e dove portano account e
// notifiche (linea guida 15, passi 8 e 10).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'attivo', reports: 'attivo' },
};
const esciSenzaEffetto = () => {};
const percorso = [{ label: 'Marketing', href: 'https://board.zeiras.com/w/acme-marketing' }, { label: 'Q4 launch' }];
/** Le aziende della persona in un ordine che non è alfabetico: il workspace dei dati è il secondo della seconda azienda. */
const aziende: NonNullable<DatiDellaCornice['aziende']> = [
    { id: '7', nome: 'Zeta Srl', workspace: [{ nome: 'Ricerca', slug: 'zeta-ricerca' }] },
    { id: '3', nome: 'Acme', workspace: [{ nome: 'Vendite', slug: 'acme-vendite' }, { nome: 'Marketing', slug: 'acme-marketing' }] },
];

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // Le rotte della cornice: senza una risposta scelta dal test, nessuna notifica.
    vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: [] })));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    // Nessun errore in console, nemmeno un avviso di React (T2.2).
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function mostra(elemento: ReactElement): Promise<void> {
    await act(async () => radice.render(elemento));
}

/** Il giro dopo: le risposte già pronte delle rotte finte arrivano tutte. */
function prossimoGiro(): Promise<void> {
    return new Promise((fatto) => setTimeout(fatto, 0));
}

/** Un clic, e una richiesta partita dal clic con la risposta già pronta arriva prima del controllo. */
async function clic(elemento: Element | null): Promise<void> {
    expect(elemento).not.toBeNull();
    await act(async () => {
        (elemento as HTMLElement).click();
        await prossimoGiro();
    });
}

/** Una risposta di una rotta della cornice, come `fetch` la dà: lo stato e il corpo JSON. */
function risposta(corpo: unknown, stato = 200): Response {
    return { ok: stato >= 200 && stato < 300, status: stato, json: async () => corpo } as Response;
}

/** Una risposta che arriva quando il test la manda: per vedere cosa c'è prima. */
function inAttesa() {
    let arriva!: (valore: Response) => void;
    const promessa = new Promise<Response>((risolvi) => (arriva = risolvi));

    return { promessa, arriva: async (valore: Response) => act(async () => { arriva(valore); await prossimoGiro(); }) };
}

function uno(selettore: string): HTMLElement | null {
    return contenitore.querySelector<HTMLElement>(selettore);
}

function tutti(selettore: string): HTMLElement[] {
    return [...contenitore.querySelectorAll<HTMLElement>(selettore)];
}

/** Il tracciato dell'icona del design system con quel nome: è ciò che distingue un'icona dall'altra nel DOM. */
function tracciatoDi(icona: IconName): string {
    const svg = Zeiras.Icon({ name: icona }) as ReactElement<{ children: ReactElement<{ d: string }> }>;

    return svg.props.children.props.d;
}

/** Un testo intero dentro il testo della pagina: «Crea» non si trova dentro «Crear». */
function frase(testo: string): RegExp {
    return new RegExp(`(^|[^\\p{L}])${testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u');
}

/** Gli indirizzi dei prodotti che non sono «Presto» per il registro: gli altri non ne hanno mai uno. */
const indirizzi: Record<string, string> = { pm: 'https://board.zeiras.com', crm: 'https://crm.zeiras.com', bookings: 'https://bookings.zeiras.com' };
const ordine = ['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'];

describe('la Cornice', () => {
    it.each<[DatiDellaCornice['prodotti'], string[]]>([
        [{ pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo' }, ['pm', 'crm']],
        [{ pm: 'in_arrivo', crm: 'attivo' }, ['crm']],
        [{ bookings: 'disponibile', automations: 'attivo', content: 'disponibile' }, ['bookings']],
        [{}, []],
        // Uno stato che zr-core non conosce (la parte server lo passa com'è) è «Presto»: portano solo `attivo` e `disponibile`.
        [{ pm: 'sospeso', crm: 'attivo' } as unknown as DatiDellaCornice['prodotti'], ['crm']],
    ])('senza product il menu è esteso: Dashboard verso app.zeiras.com, `attivo` e `disponibile` verso il workspace, gli altri «Presto» (T4.1, %j)', async (prodotti, conIndirizzo) => {
        await mostra(<Cornice dati={{ ...dati, prodotti }} onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        const gruppo = uno('.zr-nav .zr-nav-group');
        expect(gruppo?.querySelector('.zr-nav-title')?.textContent).toBe('Prodotti');
        const voci = [...(gruppo?.querySelectorAll<HTMLAnchorElement>('a.zr-nav-item') ?? [])];
        expect(voci.map((voce) => voce.querySelector('.zr-nav-label')?.textContent))
            .toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti']);
        const attesi = ordine.map((id) => (id === 'home' ? 'https://app.zeiras.com/w/acme-marketing' : conIndirizzo.includes(id) ? `${indirizzi[id]}/w/acme-marketing` : '#'));
        expect(voci.map((voce) => voce.getAttribute('href'))).toStrictEqual(attesi);
        // «Presto»: la voce non porta da nessuna parte, è disattivata e lo dice.
        const presto = attesi.map((indirizzo) => indirizzo === '#');
        expect(voci.map((voce) => voce.querySelector('.zr-nav-soon')?.textContent ?? null)).toStrictEqual(presto.map((si) => (si ? 'Presto' : null)));
        expect(voci.map((voce) => voce.getAttribute('aria-disabled'))).toStrictEqual(presto.map((si) => (si ? 'true' : null)));
        expect(voci[0].getAttribute('aria-current')).toBe('page');
        const icone: IconName[] = ['grid', 'board', 'users', 'calendar', 'chart', 'bolt', 'sparkle'];
        expect(voci.map((voce) => voce.querySelector('path')?.getAttribute('d'))).toStrictEqual(icone.map(tracciatoDi));
        expect(uno('.zr-product-switch')).toBeNull();
        expect(uno('main')?.textContent).toBe('La pagina');
    });

    it('con product="bookings" il menu si chiude nel pulsante di Bookings, e sotto ci sono le voci del prodotto (T6.2)', async () => {
        const voci = [{ id: 'oggi', label: 'Oggi', icon: 'calendar' as const }, { id: 'risorse', label: 'Risorse', icon: 'users' as const }];
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} product="bookings" active="oggi" nav={[{ group: 'Agenda', items: voci }]} />);

        const pulsante = uno('.zr-product-switch');
        expect(pulsante?.querySelector('.zr-product-name')?.textContent).toBe('Bookings');
        expect(pulsante?.querySelector('.zr-product-over')?.textContent).toBe('Prodotti');
        expect(pulsante?.querySelector('.zr-product-icon')?.classList.contains('zr-label-sky')).toBe(true);
        expect(pulsante?.querySelector('.zr-product-icon path')?.getAttribute('d')).toBe(tracciatoDi('calendar'));
        expect(tutti('.zr-nav .zr-nav-title').map((titolo) => titolo.textContent)).toStrictEqual(['Agenda']);
        expect(tutti('.zr-nav .zr-nav-label').map((voce) => voce.textContent)).toStrictEqual(['Oggi', 'Risorse']);
        expect(uno('.zr-nav a[aria-current="page"]')?.textContent).toBe('Oggi');

        // Il pulsante riapre la lista: Dashboard per prima, Bookings segnato.
        await clic(pulsante);
        const lista = tutti('.zr-product-menu a.zr-nav-item');
        expect(lista[0].textContent).toBe('Dashboard');
        expect(lista[0].getAttribute('href')).toBe('https://app.zeiras.com/w/acme-marketing');
        const bookings = uno('.zr-product-menu a[aria-current="true"]');
        expect(bookings?.querySelector('.zr-nav-label')?.textContent).toBe('Bookings');
        // Il prodotto aperto non ha indirizzo: il clic chiude la lista e lascia la pagina com'è.
        expect(bookings?.getAttribute('href')).toBe('#');
    });

    it.each([
        ['es', ['Dashboard', 'Gestión de proyectos', 'CRM', 'Reservas', 'Informes', 'Automatismos', 'Contenidos'], 'Reservas'],
        ['en', ['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content'], 'Bookings'],
        ['zz', ['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content'], 'Bookings'],
    ])('con la lingua "%s" nei dati la cornice è in quella lingua, o in inglese se zr-core non la ha, qualunque sia la lingua del browser (T4.2)', async (lingua, nomi, bookings) => {
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('it-IT');
        vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['it-IT', 'it']);
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);
        expect(appShell.mock.lastCall?.[0].labels).toStrictEqual(testi(lingua));
        expect([...(uno('.zr-nav .zr-nav-group')?.querySelectorAll('a.zr-nav-item .zr-nav-label') ?? [])].map((voce) => voce.textContent)).toStrictEqual(nomi);

        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} product="bookings" />);
        expect(uno('.zr-product-switch .zr-product-name')?.textContent).toBe(bookings);
        expect(uno('.zr-top-product')?.textContent).toBe(bookings);
        await clic(uno('.zr-product-switch'));
        expect(tutti('.zr-product-menu a.zr-nav-item .zr-nav-label').map((voce) => voce.textContent)).toStrictEqual(nomi);
    });

    it('l\'ingresso del pacchetto esporta il registro e nomeDellaVoce, per chi mostra i prodotti fuori dalla cornice (T7.2)', async () => {
        const ingresso = await import('./index');

        expect(ingresso.registro.map((voce) => ingresso.nomeDellaVoce(voce, 'en')))
            .toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content']);
    });

    it.each(['es', 'en'])('con la lingua "%s" nei dati ogni testo della cornice è in quella lingua: nessuno resta italiano (T6.3)', async (lingua) => {
        const attesi = testi(lingua);
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, lingua, aziende, non_lette: 7 }} onLogout={esciSenzaEffetto} crumbs={percorso} create={[{ label: 'Board', icon: 'board' }]} />);

        // I testi arrivano interi, e nessun alias che vincerebbe su `labels`.
        const props = appShell.mock.lastCall?.[0];
        expect(props?.labels).toStrictEqual(attesi);
        expect(props?.searchPlaceholder).toBeUndefined();
        expect(props?.createLabel).toBeUndefined();

        // Sidebar, ricerca, notifiche, menu del profilo, «+» e percorso, uno dopo l'altro: testo e attributi letti.
        const visti: string[] = [];
        const guarda = () => {
            for (const elemento of document.body.querySelectorAll('*')) {
                // Un nodo di testo alla volta: `textContent` incollerebbe «Report» e «Presto» in una parola sola.
                for (const nodo of elemento.childNodes) {
                    if (nodo.nodeType === Node.TEXT_NODE) {
                        visti.push(nodo.textContent ?? '');
                    }
                }
                for (const attributo of ['aria-label', 'placeholder', 'title']) {
                    visti.push(elemento.getAttribute(attributo) ?? '');
                }
            }
        };
        guarda();
        await clic(uno('.zr-ws-switch'));
        guarda();
        await clic(uno('.zr-bell'));
        guarda();
        await clic(uno('.zr-avatar-btn'));
        guarda();
        await clic(uno('.zr-create'));
        guarda();
        await act(async () => uno('.zr-search input')?.focus());
        guarda();
        const pagina = visti.join('\n');

        // Senza eccezioni: un testo italiano rimasto nel file della lingua è un testo non tradotto.
        for (const [chiave, italiano] of Object.entries(Zeiras.APPSHELL_LABELS)) {
            expect(pagina, chiave).not.toMatch(frase(italiano));
        }
        // Coi testi del selettore e delle non lette (T2). «Nuovo workspace» non c'è finché zr-home non ha la sua pagina; gli stati
        // delle notifiche e della ricerca tornano coi loro dati.
        const raggiunti = [
            'soon', 'settings', 'planTitle', 'planText', 'nav', 'openMenu', 'create', 'workspaceSwitch', 'search', 'searchPlaceholder',
            'searchHint', 'notifications', 'unread', 'forMe', 'all', 'seeAll', 'notificationsEmpty', 'notificationsEmptyText', 'account',
            'profile', 'accountSettings', 'plan', 'company', 'logout', 'crumbs', 'products', 'dashboard',
        ] as const;
        for (const chiave of raggiunti) {
            expect(pagina, chiave).toMatch(frase(attesi[chiave]));
        }
    });

    it('nome ed email della persona in cima al menu del profilo; il workspace dei dati come testo in cima alla sidebar, senza azienda né selettore (T4.3)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} crumbs={percorso} />);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe('Ada Lovelace');
        expect(uno('.zr-avatar-btn .zr-avatar')?.textContent).toBe('AL');
        expect(uno('.zr-workspace')?.textContent).toBe('Marketing');
        expect(appShell.mock.lastCall?.[0].companies).toBeUndefined();
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-ws-company')).toBeNull();
        expect(uno('.zr-bell-count')).toBeNull();
        expect(tutti('.zr-crumbs a, .zr-crumbs [aria-current]').map((voce) => voce.textContent)).toStrictEqual(['Marketing', 'Q4 launch']);

        await clic(uno('.zr-avatar-btn'));
        const testa = uno('.zr-profile-head');
        expect([...(testa?.querySelectorAll('.zr-profile-head > span:not(.zr-avatar) > *') ?? [])].map((riga) => riga.textContent))
            .toStrictEqual(['Ada Lovelace', 'ada@example.com']);
    });

    it.each(['board', 'home'])('con product="%s", che non è un prodotto del registro, il menu Prodotti resta esteso', async (prodotto) => {
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} product={prodotto} />);

        expect(uno('.zr-product-switch')).toBeNull();
        expect(tutti('.zr-nav .zr-nav-group')[0]?.querySelectorAll('a.zr-nav-item')).toHaveLength(7);
    });

    it('account, impostazioni e notifiche portano su app.zeiras.com; «Esci» chiama il frontend (linea guida 15)', async () => {
        const naviga = vi.fn();
        const esci = vi.fn();
        await mostra(<Cornice dati={dati} product="bookings" naviga={naviga} onLogout={esci} />);

        expect(uno('.zr-side-foot a.zr-nav-item')?.getAttribute('href')).toBe('https://app.zeiras.com/impostazioni/preferenze');
        const voceDelProfilo = async (nome: string) => {
            await clic(uno('.zr-avatar-btn'));
            await clic(tutti('.zr-profile-menu [role="menuitem"]').find((voce) => voce.textContent === nome) ?? null);
        };
        await voceDelProfilo('Profilo');
        await voceDelProfilo('Impostazioni');
        await voceDelProfilo('Piano');
        await voceDelProfilo('Azienda');
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif .zr-pop-foot button'));
        expect(naviga.mock.calls).toStrictEqual([
            ['https://app.zeiras.com/impostazioni/profilo'],
            ['https://app.zeiras.com/impostazioni/preferenze'],
            ['https://app.zeiras.com/azienda/impostazioni/piano'],
            ['https://app.zeiras.com/azienda'],
            ['https://app.zeiras.com/notifiche'],
        ]);

        await voceDelProfilo('Esci');
        expect(esci).toHaveBeenCalledOnce();
        expect(naviga).toHaveBeenCalledTimes(5);
    });
});

// Sprint 3 · T2 (voce #1277). Il selettore «Azienda › workspace» e il numero sulla campanella, dalle aziende e dalle non lette
// dei dati (linea guida 15, passo 8).
describe('il selettore «Azienda › workspace» e la campanella', () => {
    it('in cima alla sidebar azienda e workspace attivo; aperto, ogni azienda coi suoi workspace nell\'ordine dei dati, la ✓ sull\'attivo, nessun «Nuovo workspace» (T2.1)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende }} onLogout={esciSenzaEffetto} />);

        const pulsante = uno('.zr-ws-switch');
        expect(pulsante?.querySelector('.zr-ws-company')?.textContent).toBe('Acme');
        expect(pulsante?.querySelector('.zr-ws-name')?.textContent).toBe('Marketing');
        expect(uno('.zr-workspace')).toBeNull();
        // Nessun tono: il backoffice non dà grafica. Nessun «Nuovo workspace» finché zr-home non ha la sua pagina.
        expect(appShell.mock.lastCall?.[0].companies).toStrictEqual([
            { id: '7', name: 'Zeta Srl', workspaces: [{ slug: 'zeta-ricerca', name: 'Ricerca' }] },
            { id: '3', name: 'Acme', workspaces: [{ slug: 'acme-vendite', name: 'Vendite' }, { slug: 'acme-marketing', name: 'Marketing' }] },
        ]);
        expect(appShell.mock.lastCall?.[0].onNewWorkspace).toBeUndefined();

        await clic(pulsante);
        const gruppi = tutti('.zr-ws-menu .zr-ws-group');
        expect(gruppi.map((gruppo) => gruppo.querySelector('.zr-ws-group-title')?.textContent)).toStrictEqual(['Zeta Srl', 'Acme']);
        expect(gruppi.map((gruppo) => [...gruppo.querySelectorAll('.zr-ws-item .zr-nav-label')].map((voce) => voce.textContent)))
            .toStrictEqual([['Ricerca'], ['Vendite', 'Marketing']]);
        const attivi = tutti('.zr-ws-menu .zr-ws-item[aria-current="true"]');
        expect(attivi.map((voce) => voce.querySelector('.zr-nav-label')?.textContent)).toStrictEqual(['Marketing']);
        expect(attivi[0].querySelector('svg path')?.getAttribute('d')).toBe(tracciatoDi('check'));
        expect(tutti('.zr-ws-menu .zr-ws-item:not([aria-current]) svg')).toHaveLength(0);
        expect(uno('.zr-ws-new')).toBeNull();
        expect(uno('.zr-ws-menu')?.textContent).not.toMatch(frase(testi('it').newWorkspace));
    });

    it.each([
        [undefined, 'Ricerca', 'https://app.zeiras.com/w/zeta-ricerca'],
        ['pm', 'Vendite', 'https://board.zeiras.com/w/acme-vendite'],
        ['bookings', 'Ricerca', 'https://bookings.zeiras.com/w/zeta-ricerca'],
        // Un prodotto che il registro non ha è una pagina di app.zeiras.com.
        ['board', 'Vendite', 'https://app.zeiras.com/w/acme-vendite'],
    ])('con product=%s scegliere «%s» porta allo stesso prodotto nel workspace scelto, o alla Dashboard (T2.2)', async (product, nome, indirizzo) => {
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, aziende }} product={product} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-ws-switch'));
        await clic(tutti('.zr-ws-menu .zr-ws-item').find((voce) => voce.textContent === nome) ?? null);
        expect(naviga.mock.calls).toStrictEqual([[indirizzo]]);
    });

    it.each<[string, DatiDellaCornice['aziende']]>([
        ['senza aziende', undefined],
        ['con un elenco vuoto', []],
        // Senza il controllo l'`AppShell` segnerebbe attivo il primo workspace della prima azienda: un workspace sbagliato.
        ['col workspace dei dati in nessuna azienda', [aziende[0], { id: '3', nome: 'Acme', workspace: [{ nome: 'Vendite', slug: 'acme-vendite' }] }]],
    ])('%s il workspace resta testo, senza selettore (T2.3)', async (_caso, aziendeDeiDati) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende: aziendeDeiDati }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-workspace')?.textContent).toBe('Marketing');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(uno('.zr-ws-company')).toBeNull();
        expect(appShell.mock.lastCall?.[0].companies).toBeUndefined();
    });

    it.each<[number | undefined, string | null]>([
        [undefined, null],
        [0, null],
        [7, '7'],
        [100, '99+'],
    ])('con %s non lette nei dati la campanella mostra %s, senza aver aperto le notifiche (T2.4)', async (nonLette, numero) => {
        await mostra(<Cornice dati={{ ...dati, non_lette: nonLette }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-bell-count')?.textContent ?? null).toBe(numero);
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe(numero === null ? 'Notifiche' : `Notifiche, ${numero} non lette`);
    });
});

// Sprint 3 · T4 (voce #1277), riscritto nello sprint 5 · T3 (voce #1257). Il pannello delle notifiche coi dati di
// GET /cornice/notifiche (`{id, creata_il, letta}`: il contratto non dice di che prodotto è una notifica, né per chi), «Segna
// tutte come lette» con una PATCH /cornice/notifiche/<id>/lettura per ogni non letta caricata, e dove portano una notifica e
// «Vedi tutte» (linea guida 15, passo 10).
describe('il pannello delle notifiche', () => {
    /** Le notifiche come le dà GET /cornice/notifiche, dalla più recente; «adesso» è il 6 ottobre 2026 alle 12:00 UTC. */
    const adesso = new Date('2026-10-06T12:00:00Z');
    const notificheDelServer = [
        { id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false },
        { id: 'uat-n40', creata_il: '2026-10-05T12:00:00Z', letta: false },
        { id: 'uat-n39', creata_il: '2026-10-01T09:00:00Z', letta: true },
    ];
    /** Una terza non letta, la più recente: per vedere dove si ferma una lettura che fallisce. */
    const conUnaInPiu = [{ id: 'uat-n42', creata_il: '2026-10-06T11:58:00Z', letta: false }, ...notificheDelServer];
    /**
     * Ciò che la parte server non dà: i campi della bozza (`per_me`, `motivo`, `app`) e quelli che del backoffice restano là
     * (`tipo`, `soggetto`). Se arrivassero lo stesso, il pannello non li userebbe.
     */
    const conAltriCampi = [
        { ...notificheDelServer[0], per_me: true, motivo: 'menzione', app: 'pm', tipo: 'com.zeiras.board.cartella.creata', soggetto: '/v1/board/cartelle/uat-cartella-1' },
        { ...notificheDelServer[1], per_me: false, motivo: 'assegnazione', app: 'crm' },
        notificheDelServer[2],
    ];

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(adesso);
    });

    /** Il cookie del gettone CSRF che Laravel dà alla pagina; senza valore, scaduto. */
    const cookieCsrf = (valore?: string) => {
        const nome = 'XSRF-TOKEN';
        document.cookie = valore === undefined ? `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` : `${nome}=${valore}; path=/`;
    };

    afterEach(() => {
        vi.useRealTimers();
        cookieCsrf();
    });

    const voci = () => tutti('.zr-notif-list .zr-notif-item');
    const tono = (voce: HTMLElement) => [...(voce.querySelector('.zr-iconbox')?.classList ?? [])].find((classe) => classe.startsWith('zr-label-'));
    const nonLette = () => voci().map((voce) => voce.classList.contains('is-unread'));
    const campanella = () => uno('.zr-bell-count')?.textContent ?? null;
    const segnaTutte = () => uno('.zr-notif .zr-pop-head button');
    /** Le richieste partite, nell'ordine: il metodo e l'indirizzo. */
    const richieste = (fetchFinto: { mock: { calls: [indirizzo: string, opzioni?: RequestInit][] } }) => fetchFinto.mock.calls.map(([indirizzo, opzioni]) => `${opzioni?.method ?? 'GET'} ${indirizzo}`);
    /** La risposta della parte server a una lettura riuscita. */
    const letta = (id: string) => risposta({ data: { id, letta: true } });
    /** Le due rotte che rispondono subito: l'elenco dato, e ogni lettura riuscita. */
    const rotte = (elenco: unknown[]) => vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: elenco }) : letta(decodeURIComponent(indirizzo.split('/')[3]))));

    it.each([
        ['it', 'Nuova attività', ['5 minuti fa', 'ieri', '1 ott']],
        ['es', 'Nueva actividad', ['hace 5 minutos', 'ayer', '1 oct']],
        ['en', 'New activity', ['5 minutes ago', 'yesterday', 'Oct 1']],
        // Come la scrive un sistema: la lingua è la stessa, e `Intl` non la rifiuta.
        ['it_IT', 'Nuova attività', ['5 minuti fa', 'ieri', '1 ott']],
    ])('con la lingua "%s", aprendo la campanella il pannello è in caricamento, poi mostra ogni notifica col titolo della lingua e l\'ora, senza prodotto, in «Per me» come in «Tutte» (sprint 5 · T3.1)', async (lingua, titolo, ore) => {
        const elenco = inAttesa();
        const fetchFinto = vi.fn((_indirizzo: string, _opzioni?: RequestInit) => elenco.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        // Non con la pagina: il numero sulla campanella viene dai dati.
        expect(fetchFinto).not.toHaveBeenCalled();

        await clic(uno('.zr-bell'));
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
        expect(uno('.zr-notif [role="status"]')).not.toBeNull();
        expect(uno('.zr-notif-list')).toBeNull();

        await elenco.arriva(risposta({ data: conAltriCampi }));
        expect(uno('.zr-notif [role="status"]')).toBeNull();
        // «Per me», poi «Tutte»: le stesse notifiche, anche quella che la bozza dava per altri.
        expect(tutti('.zr-notif-tabs [role="tab"]')).toHaveLength(2);
        for (const scheda of [0, 1]) {
            await clic(tutti('.zr-notif-tabs [role="tab"]')[scheda]);
            expect(tutti('.zr-notif-tabs [role="tab"]').map((voce) => voce.getAttribute('aria-selected'))).toStrictEqual(scheda === 0 ? ['true', 'false'] : ['false', 'true']);
            expect(voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent)).toStrictEqual([titolo, titolo, titolo]);
            // Solo l'ora: nessun prodotto davanti, nemmeno per l'app o il tipo di un prodotto del registro.
            expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(ore);
            expect(nonLette()).toStrictEqual([true, true, false]);
            expect(voci().map((voce) => voce.querySelectorAll('.zr-notif-dot').length)).toStrictEqual([1, 1, 0]);
            // La campanella e il tono neutro del design system: né l'icona né il tono di un prodotto.
            expect(voci().map((voce) => voce.querySelector('.zr-iconbox path')?.getAttribute('d'))).toStrictEqual([tracciatoDi('bell'), tracciatoDi('bell'), tracciatoDi('bell')]);
            expect(voci().map(tono)).toStrictEqual(['zr-label-neutral', 'zr-label-neutral', 'zr-label-neutral']);
        }
        expect(fetchFinto).toHaveBeenCalledOnce();
    });

    it.each<[string, () => Promise<Response>]>([
        ['una risposta 502', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['la rete giù', async () => { throw new TypeError('Failed to fetch'); }],
        ['un 200 senza lista', async () => risposta({ data: null })],
    ])('con %s il pannello mostra l\'errore con «Riprova», non «Nessuna notifica»; «Riprova» ricarica (T4.2)', async (_caso, fallisce) => {
        const fetchFinto = vi.fn().mockImplementationOnce(fallisce).mockImplementationOnce(async () => risposta({ data: notificheDelServer }));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        const errore = uno('.zr-notif [role="alert"]');
        expect(errore?.querySelector('p')?.textContent).toBe('Non riusciamo a caricare le notifiche.');
        expect(uno('.zr-notif .zr-empty')).toBeNull();
        expect(voci()).toHaveLength(0);

        await clic(errore?.querySelector('button') ?? null);
        expect(fetchFinto).toHaveBeenCalledTimes(2);
        expect(uno('.zr-notif [role="alert"]')).toBeNull();
        expect(voci()).toHaveLength(3);
    });

    it('«Segna tutte come lette» manda una PATCH col gettone CSRF per ogni non letta caricata, una dopo l\'altra nell\'ordine dell\'elenco; a ogni risposta quella notifica è letta e la campanella scende di uno, da 12 a 10 (sprint 5 · T3.2)', async () => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        const letture = [inAttesa(), inAttesa()];
        let partite = 0;
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer }) : letture[partite++].promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('12');

        await clic(segnaTutte());
        // Parte solo la prima dell'elenco: la seconda aspetta la sua risposta.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'PATCH /cornice/notifiche/uat-n41/lettura']);
        for (const [, opzioni] of fetchFinto.mock.calls.slice(1)) {
            expect(new Headers(opzioni?.headers).get('X-XSRF-TOKEN')).toBe('eyJpdiI6Ik1h==');
            expect(new Headers(opzioni?.headers).get('Content-Type')).toBe('application/json');
            expect(JSON.parse(String(opzioni?.body))).toStrictEqual({ letta: true });
        }
        // Prima della risposta non cambia niente, e un altro clic non manda una seconda richiesta.
        expect(campanella()).toBe('12');
        expect(nonLette()).toStrictEqual([true, true, false]);
        await clic(segnaTutte());
        expect(fetchFinto).toHaveBeenCalledTimes(2);

        await letture[0].arriva(letta('uat-n41'));
        expect(campanella()).toBe('11');
        expect(nonLette()).toStrictEqual([false, true, false]);
        expect(richieste(fetchFinto).slice(2)).toStrictEqual(['PATCH /cornice/notifiche/uat-n40/lettura']);
        for (const [, opzioni] of fetchFinto.mock.calls.slice(2)) {
            expect(new Headers(opzioni?.headers).get('X-XSRF-TOKEN')).toBe('eyJpdiI6Ik1h==');
            expect(JSON.parse(String(opzioni?.body))).toStrictEqual({ letta: true });
        }
        await clic(segnaTutte());
        expect(fetchFinto).toHaveBeenCalledTimes(3);

        await letture[1].arriva(letta('uat-n40'));
        // 12 nei dati e 2 non lette caricate: 10, non zero.
        expect(campanella()).toBe('10');
        expect(nonLette()).toStrictEqual([false, false, false]);
        // Per quella già letta non parte niente; senza non lette caricate il pulsante non c'è più.
        expect(fetchFinto).toHaveBeenCalledTimes(3);
        expect(segnaTutte()).toBeNull();
    });

    it('l\'id di una notifica entra codificato nell\'indirizzo della sua lettura (sprint 5 · T3.2)', async () => {
        const fetchFinto = rotte([{ id: 'a/b?c#d e', creata_il: '2026-10-06T11:55:00Z', letta: false }]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'PATCH /cornice/notifiche/a%2Fb%3Fc%23d%20e/lettura']);
        expect(nonLette()).toStrictEqual([false]);
    });

    it.each<[number | undefined, string | null]>([
        // Meno non lette nei dati di quelle caricate (una è arrivata dopo): il numero si ferma a zero.
        [1, '1'],
        // Senza il numero nei dati il design system conta le non lette caricate.
        [undefined, '2'],
    ])('con %s non lette nei dati e due caricate, segnate tutte e due la campanella non ha più un numero (sprint 5 · T3.2)', async (nonLetteNeiDati, prima) => {
        const fetchFinto = rotte(notificheDelServer);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: nonLetteNeiDati }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe(prima);

        await clic(segnaTutte());
        expect(richieste(fetchFinto).slice(1)).toStrictEqual(['PATCH /cornice/notifiche/uat-n41/lettura', 'PATCH /cornice/notifiche/uat-n40/lettura']);
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
    });

    it.each<[string, () => Promise<Response>]>([
        ['una risposta 502', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['un 404', async () => risposta({ errore: 'non_trovato' }, 404)],
        ['la rete giù', async () => { throw new TypeError('Failed to fetch'); }],
        ['un 200 che la dà non letta', async () => risposta({ data: { id: 'uat-n41', letta: false } })],
        ['un 200 senza dati', async () => risposta({})],
    ])('se una lettura fallisce con %s si ferma lì: le segnate restano lette, le altre no, e il numero conta solo le segnate; un altro clic riprende da quella (sprint 5 · T3.3)', async (_caso, fallisce) => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        const fetchFinto = vi.fn<(indirizzo: string, opzioni?: RequestInit) => Promise<Response>>()
            .mockImplementationOnce(async () => risposta({ data: conUnaInPiu }))
            .mockImplementationOnce(async () => letta('uat-n42'))
            .mockImplementationOnce(fallisce)
            .mockImplementation(async (indirizzo) => letta(indirizzo.split('/')[3]));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        await clic(segnaTutte());
        // La terza non parte: dopo l'errore non si va avanti.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'PATCH /cornice/notifiche/uat-n42/lettura', 'PATCH /cornice/notifiche/uat-n41/lettura']);
        expect(campanella()).toBe('11');
        expect(nonLette()).toStrictEqual([false, true, true, false]);

        await clic(segnaTutte());
        expect(richieste(fetchFinto).slice(3)).toStrictEqual(['PATCH /cornice/notifiche/uat-n41/lettura', 'PATCH /cornice/notifiche/uat-n40/lettura']);
        expect(campanella()).toBe('9');
        expect(nonLette()).toStrictEqual([false, false, false, false]);
    });

    it('il numero sceso vale coi dati di prima; coi dati nuovi della parte server la campanella mostra il loro numero, anche se è lo stesso (sprint 5 · T3.4)', async () => {
        vi.stubGlobal('fetch', rotte(notificheDelServer));
        const primi = { ...dati, non_lette: 12 };
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBe('10');

        // La stessa pagina ridisegnata con gli stessi dati: il numero resta sceso.
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('10');

        // Una visita dopo (Inertia tiene montata la cornice): i dati nuovi contano già le lette, anche se il numero è lo stesso.
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');
    });

    it('senza aver aperto la campanella «Segna tutte come lette» non c\'è, anche con 12 non lette nei dati (sprint 5 · T3.5)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);

        expect(campanella()).toBe('12');
        expect(appShell.mock.lastCall?.[0].onMarkAllRead).toBeUndefined();
    });

    it.each<[string, () => Promise<Response>]>([
        ['in caricamento', () => new Promise<Response>(() => {})],
        ['in errore', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['con le notifiche tutte lette', async () => risposta({ data: notificheDelServer.map((notifica) => ({ ...notifica, letta: true })) })],
        ['senza notifiche', async () => risposta({ data: [] })],
    ])('col pannello %s «Segna tutte come lette» non c\'è, anche con 12 non lette nei dati (sprint 5 · T3.5)', async (_caso, elenco) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        vi.stubGlobal('fetch', vi.fn(elenco));
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif .zr-pop-head')).not.toBeNull();
        expect(segnaTutte()).toBeNull();
        expect(appShell.mock.lastCall?.[0].onMarkAllRead).toBeUndefined();
        expect(campanella()).toBe('12');
    });

    it('il clic su una notifica e «Vedi tutte» aprono la pagina delle notifiche su app.zeiras.com, anche da un prodotto (sprint 5 · T3.6)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: notificheDelServer })));
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} product="pm" naviga={naviga} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        await clic(voci()[0]);
        expect(uno('.zr-notif')).toBeNull();
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif .zr-pop-foot button'));
        expect(naviga.mock.calls).toStrictEqual([['https://app.zeiras.com/notifiche'], ['https://app.zeiras.com/notifiche']]);
    });
});

// Sprint 3 · T5 (voce #1277). La ricerca Ctrl/Cmd+K attraverso GET /cornice/ricerca: una richiesta sola in volo, i risultati
// raggruppati per tipo dal registro, gli stati. Sprint 5 · T4 (voce #1257): un risultato è `{tipo, id, titolo}`, come in
// ricerca.elenca; di che prodotto è lo dice il registro, dal tipo.
describe('la ricerca', () => {
    /**
     * I risultati come li dà GET /cornice/ricerca, nell'ordine del backoffice (per titolo): i tipi mescolati (l'`AppShell` apre
     * un gruppo a ogni cambio di gruppo), lo stesso id in due tipi, due tipi che il registro non ha (uno mai visto, e le schede,
     * che la ricerca del backoffice ancora non cerca) e un risultato con un `app` che non è il suo prodotto: non conta.
     */
    const risultatiDelServer = [
        { tipo: 'board.board', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Lancio Q4' },
        { tipo: 'board.cartelle', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Marketing' },
        { tipo: 'uat-ignoto', id: '9', titolo: 'Piano di un tipo ignoto' },
        { app: 'crm', tipo: 'board.board', id: 'uat/13', titolo: 'Report marketing' },
        { tipo: 'board.schede', id: '12', titolo: 'Scrivere il brief' },
    ];

    // I 300 ms che l'`AppShell` aspetta dopo l'ultimo tasto passano quando lo dice il test.
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Il giro dopo, coi timer finti: le risposte già pronte arrivano. */
    const giro = () => vi.advanceTimersByTimeAsync(0);

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

    /** Una risposta della ricerca che arriva, o fallisce, quando il test lo dice. */
    function inAttesaDellaRicerca() {
        let arriva!: (valore: Response) => void;
        let fallisce!: (errore: unknown) => void;
        const promessa = new Promise<Response>((risolvi, rifiuta) => {
            arriva = risolvi;
            fallisce = rifiuta;
        });

        return {
            promessa,
            arriva: async (valore: Response) => act(async () => { arriva(valore); await giro(); }),
            fallisce: async (errore: unknown) => act(async () => { fallisce(errore); await giro(); }),
        };
    }

    const righe = () => tutti('.zr-search-panel [role="option"]');
    const titoli = () => righe().map((riga) => riga.querySelector('.zr-search-title')?.textContent);
    const inCaricamento = () => uno('.zr-search-panel [role="status"] .zr-visually-hidden')?.textContent;
    const vecchi = [{ tipo: 'board.board', id: '1', titolo: 'Risultato di «ua»' }];
    const nuovi = [{ tipo: 'board.board', id: '2', titolo: 'Risultato di «uat»' }];

    it.each<[string, (ua: ReturnType<typeof inAttesaDellaRicerca>, uat: ReturnType<typeof inAttesaDellaRicerca>) => Promise<void>]>([
        ['arriva prima della nuova', async (ua, uat) => {
            await ua.arriva(risposta({ data: vecchi }));
            // La parola è «uat»: la ricerca resta in caricamento, senza i risultati di «ua».
            expect(inCaricamento()).toBe('Sto cercando…');
            expect(righe()).toHaveLength(0);
            await uat.arriva(risposta({ data: nuovi }));
        }],
        ['arriva dopo la nuova', async (ua, uat) => {
            await uat.arriva(risposta({ data: nuovi }));
            await ua.arriva(risposta({ data: vecchi }));
        }],
        ['annullata, finisce con un errore', async (ua, uat) => {
            await ua.fallisce(new DOMException('The operation was aborted.', 'AbortError'));
            expect(inCaricamento()).toBe('Sto cercando…');
            expect(uno('.zr-search-panel [role="alert"]')).toBeNull();
            await uat.arriva(risposta({ data: nuovi }));
        }],
    ])('mentre si scrive c\'è al più una ricerca in volo: la parola nuova annulla la richiesta di prima, e restano i risultati dell\'ultima anche se la vecchia %s (T5.2)', async (_caso, rispondono) => {
        const ua = inAttesaDellaRicerca();
        const uat = inAttesaDellaRicerca();
        const fetchFinto = vi.fn((indirizzo: string, _opzioni?: RequestInit) => (indirizzo.endsWith('=ua') ? ua.promessa : uat.promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('ua');
        await scrivi('uat');
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(['/cornice/ricerca?q=ua', '/cornice/ricerca?q=uat']);
        expect(fetchFinto.mock.calls.map(([, opzioni]) => opzioni?.signal?.aborted)).toStrictEqual([true, false]);
        expect(inCaricamento()).toBe('Sto cercando…');

        await rispondono(ua, uat);
        expect(titoli()).toStrictEqual(['Risultato di «uat»']);
        expect(fetchFinto).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['it', 'Project Management', ['Board', 'Cartelle']],
        ['es', 'Gestión de proyectos', ['Tableros', 'Carpetas']],
        ['en', 'Project Management', ['Boards', 'Folders']],
    ])('con la lingua "%s" i risultati stanno raggruppati per tipo, col nome e il tono del prodotto che ha quel tipo nel registro e l\'icona del tipo, anche se il risultato porta un `app` di un altro prodotto; un tipo che il registro non ha non compare (sprint 5 · T4.3, T4.4)', async (lingua, prodotto, nomiDeiGruppi) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultatiDelServer })));
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(tutti('.zr-search-panel .zr-search-group').map((gruppo) => gruppo.textContent)).toStrictEqual(nomiDeiGruppi);
        // Nell'ordine del backoffice dentro ogni tipo; i tipi nell'ordine del primo risultato di ognuno. «Report marketing» ha
        // `app: 'crm'`: è una board, quindi di Project Management.
        expect(titoli()).toStrictEqual(['Lancio Q4', 'Report marketing', 'Marketing']);
        expect(righe().map((riga) => riga.querySelector('.zr-search-product')?.textContent)).toStrictEqual([prodotto, prodotto, prodotto]);
        expect(righe().map((riga) => [...(riga.querySelector('.zr-iconbox')?.classList ?? [])].find((classe) => classe.startsWith('zr-label-'))))
            .toStrictEqual(['zr-label-pine', 'zr-label-pine', 'zr-label-pine']);
        expect(righe().map((riga) => riga.querySelector('.zr-iconbox path')?.getAttribute('d')))
            .toStrictEqual([tracciatoDi('board'), tracciatoDi('board'), tracciatoDi('folder')]);
    });

    it.each([
        ['Lancio Q4', 'https://board.zeiras.com/w/acme-marketing/b/01k6w2d5f7h9k1n3q5s7v9x1z3'],
        ['Marketing', 'https://board.zeiras.com/w/acme-marketing/cartelle/01k6w2d5f7h9k1n3q5s7v9x1z3'],
        // Con `app: 'crm'` l'indirizzo resta quello di Project Management, e l'id entra codificato.
        ['Report marketing', 'https://board.zeiras.com/w/acme-marketing/b/uat%2F13'],
    ])('scegliere «%s» apre l\'indirizzo del prodotto che ha quel tipo nel registro, nel workspace dei dati, seguito dal percorso del tipo, anche da un altro prodotto (sprint 5 · T4.3)', async (titolo, indirizzo) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultatiDelServer })));
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} product="crm" naviga={naviga} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        const scelto = righe().find((riga) => riga.querySelector('.zr-search-title')?.textContent === titolo);
        expect(scelto).toBeDefined();
        await act(async () => {
            scelto?.click();
            await giro();
        });
        expect(naviga.mock.calls).toStrictEqual([[indirizzo]]);
        expect(uno('.zr-search-panel')).toBeNull();
    });

    it.each([
        ['vuoto', []],
        ['di soli tipi che il registro non ha', [risultatiDelServer[2], risultatiDelServer[4]]],
    ])('durante l\'attesa la ricerca è in caricamento; con un elenco %s mostra «Nessun risultato per» e la parola (T5.4; sprint 5 · T4.4)', async (_caso, risultati) => {
        const elenco = inAttesaDellaRicerca();
        const fetchFinto = vi.fn((_indirizzo: string, _opzioni?: RequestInit) => elenco.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('caffè latte');
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(['/cornice/ricerca?q=caff%C3%A8%20latte']);
        expect(inCaricamento()).toBe('Sto cercando…');
        expect(righe()).toHaveLength(0);

        await elenco.arriva(risposta({ data: risultati }));
        expect(inCaricamento()).toBeUndefined();
        expect(uno('.zr-search-panel [role="status"] strong')?.textContent).toBe('Nessun risultato per «caffè latte»');
        expect(uno('.zr-search-panel [role="alert"]')).toBeNull();
    });

    it.each<[string, () => Promise<Response>]>([
        ['una risposta 502', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['una risposta 422', async () => risposta({ errore: 'dati_non_validi' }, 422)],
        ['la rete giù', async () => { throw new TypeError('Failed to fetch'); }],
        ['un 200 senza lista', async () => risposta({ data: null })],
    ])('con %s la ricerca mostra il suo errore, non «Nessun risultato» (T5.4)', async (_caso, fallisce) => {
        vi.stubGlobal('fetch', vi.fn(fallisce));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(uno('.zr-search-panel [role="alert"]')?.textContent).toBe('La ricerca non ha risposto. Riprova tra poco.');
        expect(uno('.zr-search-panel')?.textContent).not.toContain('Nessun risultato per');
        expect(righe()).toHaveLength(0);
    });

    it.each([
        // Contati in caratteri, come `mb_strlen` della parte server, non in unità UTF-16: un'emoji ne vale due.
        ['101 emoji', '😀'.repeat(101), '😀'.repeat(100)],
        ['60 emoji', '😀'.repeat(60), '😀'.repeat(60)],
        ['150 lettere accentate', 'à'.repeat(150), 'à'.repeat(100)],
    ])('una parola di %s arriva alla parte server coi primi 100 caratteri, e la ricerca risponde invece di dare errore (T5.4)', async (_caso, parola, mandata) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: [risultatiDelServer[0]] }));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi(parola);
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual([`/cornice/ricerca?q=${encodeURIComponent(mandata)}`]);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
    });
});
