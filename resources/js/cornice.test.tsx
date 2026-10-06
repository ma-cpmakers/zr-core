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

// Sprint 3 · T4 (voce #1277). Il pannello delle notifiche coi dati di GET /cornice/notifiche, «Segna tutte come lette» con
// PATCH /cornice/notifiche/lettura, e dove portano una notifica e «Vedi tutte» (linea guida 15, passo 10).
describe('il pannello delle notifiche', () => {
    /** Le notifiche come le dà GET /cornice/notifiche, dalla più recente; «adesso» è il 6 ottobre 2026 alle 12:00 UTC. */
    const adesso = new Date('2026-10-06T12:00:00Z');
    const notificheDelServer = [
        { id: 41, creata_il: '2026-10-06T11:55:00+00:00', letta: false, per_me: true, motivo: 'menzione', app: 'pm' },
        { id: 40, creata_il: '2026-10-05T12:00:00Z', letta: false, per_me: false, motivo: 'assegnazione', app: 'crm' },
        // Un'app che il registro non ha: nessun prodotto, la campanella, tono neutro.
        { id: 39, creata_il: '2026-10-01T09:00:00Z', letta: true, per_me: true, motivo: 'menzione', app: 'zz' },
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

    it.each([
        ['it', 'Nuova attività', ['Project Management · 5 minuti fa', '1 ott'], ['Project Management · 5 minuti fa', 'CRM · ieri', '1 ott']],
        ['es', 'Nueva actividad', ['Gestión de proyectos · hace 5 minutos', '1 oct'], ['Gestión de proyectos · hace 5 minutos', 'CRM · ayer', '1 oct']],
        ['en', 'New activity', ['Project Management · 5 minutes ago', 'Oct 1'], ['Project Management · 5 minutes ago', 'CRM · yesterday', 'Oct 1']],
        // Come la scrive un sistema: la lingua è la stessa, e `Intl` non la rifiuta.
        ['it_IT', 'Nuova attività', ['Project Management · 5 minuti fa', '1 ott'], ['Project Management · 5 minuti fa', 'CRM · ieri', '1 ott']],
    ])('con la lingua "%s", aprendo la campanella il pannello è in caricamento, poi mostra le notifiche nella lingua; «Per me» solo quelle per la persona (T4.1)', async (lingua, titolo, perMe, tutte) => {
        const elenco = inAttesa();
        const fetchFinto = vi.fn((_indirizzo: string, _opzioni?: RequestInit) => elenco.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        // Non con la pagina: il numero sulla campanella viene dai dati.
        expect(fetchFinto).not.toHaveBeenCalled();

        await clic(uno('.zr-bell'));
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(['/cornice/notifiche']);
        expect(uno('.zr-notif [role="status"]')).not.toBeNull();
        expect(uno('.zr-notif-list')).toBeNull();

        await elenco.arriva(risposta({ data: notificheDelServer }));
        expect(uno('.zr-notif [role="status"]')).toBeNull();
        expect(voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent)).toStrictEqual([titolo, titolo]);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(perMe);
        expect(voci().map((voce) => voce.classList.contains('is-unread'))).toStrictEqual([true, false]);
        expect(voci().map((voce) => voce.querySelector('.zr-iconbox path')?.getAttribute('d'))).toStrictEqual([tracciatoDi('board'), tracciatoDi('bell')]);
        expect(voci().map(tono)).toStrictEqual(['zr-label-pine', 'zr-label-neutral']);

        await clic(tutti('.zr-notif-tabs [role="tab"]')[1]);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent)).toStrictEqual([titolo, titolo, titolo]);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(tutte);
        expect(voci().map((voce) => voce.classList.contains('is-unread'))).toStrictEqual([true, true, false]);
        expect(voci().map(tono)).toStrictEqual(['zr-label-pine', 'zr-label-sky', 'zr-label-neutral']);
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
        expect(voci()).toHaveLength(2);
    });

    it('«Segna tutte come lette» manda il creata_il della più recente col gettone CSRF; a risposta arrivata la campanella va a 0 e le notifiche sono lette (T4.3)', async () => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        const lettura = inAttesa();
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer }) : lettura.promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(tutti('.zr-notif-tabs [role="tab"]')[1]);
        expect(uno('.zr-bell-count')?.textContent).toBe('2');

        await clic(uno('.zr-notif .zr-pop-head button'));
        expect(fetchFinto).toHaveBeenCalledTimes(2);
        const [indirizzo, opzioni] = fetchFinto.mock.calls[1];
        expect(indirizzo).toBe('/cornice/notifiche/lettura');
        expect(opzioni?.method).toBe('PATCH');
        expect(new Headers(opzioni?.headers).get('X-XSRF-TOKEN')).toBe('eyJpdiI6Ik1h==');
        // L'istante della più recente com'è arrivato, non l'ora del browser.
        expect(JSON.parse(String(opzioni?.body))).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00' });
        // Prima della risposta non cambia niente.
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
        expect(voci().map((voce) => voce.classList.contains('is-unread'))).toStrictEqual([true, true, false]);

        await lettura.arriva(risposta({ data: { fino_a: '2026-10-06T11:55:00+00:00' } }));
        expect(uno('.zr-bell-count')).toBeNull();
        expect(voci().map((voce) => voce.classList.contains('is-unread'))).toStrictEqual([false, false, false]);
        expect(uno('.zr-notif .zr-pop-head button')).toBeNull();
    });

    it('se «Segna tutte come lette» fallisce, il numero e le notifiche restano come prima (T4.3)', async () => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer }) : risposta({ errore: 'dati_non_validi' }, 422))));
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(tutti('.zr-notif-tabs [role="tab"]')[1]);

        await clic(uno('.zr-notif .zr-pop-head button'));
        expect(uno('.zr-bell-count')?.textContent).toBe('2');
        expect(voci().map((voce) => voce.classList.contains('is-unread'))).toStrictEqual([true, true, false]);
        expect(uno('.zr-notif .zr-pop-head button')).not.toBeNull();
    });

    it('il clic su una notifica e «Vedi tutte» aprono la pagina delle notifiche su app.zeiras.com, anche da un prodotto (T4.4)', async () => {
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
// raggruppati per tipo dal registro, gli stati.
describe('la ricerca', () => {
    /**
     * I risultati come li dà GET /cornice/ricerca, per pertinenza: i tipi mescolati (l'`AppShell` apre un gruppo a ogni cambio di
     * gruppo), lo stesso id in due tipi, un tipo e un'app che zr-core non conosce.
     */
    const risultatiDelServer = [
        { app: 'pm', tipo: 'board', id: 12, titolo: 'Lancio Q4' },
        { app: 'pm', tipo: 'cartella', id: '3', titolo: 'Marketing' },
        { app: 'pm', tipo: 'uat-ignoto', id: 9, titolo: 'Un tipo ignoto' },
        { app: 'zz', tipo: 'board', id: 5, titolo: 'Un\'app ignota' },
        { app: 'pm', tipo: 'scheda', id: 12, titolo: 'Scrivere il brief' },
        { app: 'pm', tipo: 'board', id: 13, titolo: 'Lancio Q1' },
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
    const vecchi = [{ app: 'pm', tipo: 'board', id: 1, titolo: 'Risultato di «ua»' }];
    const nuovi = [{ app: 'pm', tipo: 'board', id: 2, titolo: 'Risultato di «uat»' }];

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
        ['it', 'Project Management', ['Board', 'Cartelle', 'Schede']],
        ['es', 'Gestión de proyectos', ['Tableros', 'Carpetas', 'Tarjetas']],
        ['en', 'Project Management', ['Boards', 'Folders', 'Cards']],
    ])('con la lingua "%s" i risultati stanno raggruppati per tipo, col nome e il tono del prodotto e l\'icona del tipo; un tipo o un\'app che zr-core non conosce non compaiono (T5.3)', async (lingua, prodotto, nomiDeiGruppi) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultatiDelServer })));
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(tutti('.zr-search-panel .zr-search-group').map((gruppo) => gruppo.textContent)).toStrictEqual(nomiDeiGruppi);
        // Nell'ordine del backoffice dentro ogni tipo; i tipi nell'ordine del primo risultato di ognuno.
        expect(titoli()).toStrictEqual(['Lancio Q4', 'Lancio Q1', 'Marketing', 'Scrivere il brief']);
        expect(righe().map((riga) => riga.querySelector('.zr-search-product')?.textContent)).toStrictEqual([prodotto, prodotto, prodotto, prodotto]);
        expect(righe().map((riga) => [...(riga.querySelector('.zr-iconbox')?.classList ?? [])].find((classe) => classe.startsWith('zr-label-'))))
            .toStrictEqual(['zr-label-pine', 'zr-label-pine', 'zr-label-pine', 'zr-label-pine']);
        expect(righe().map((riga) => riga.querySelector('.zr-iconbox path')?.getAttribute('d')))
            .toStrictEqual([tracciatoDi('board'), tracciatoDi('board'), tracciatoDi('folder'), tracciatoDi('board')]);
    });

    it.each([
        ['Lancio Q4', 'https://board.zeiras.com/w/acme-marketing/b/12'],
        ['Marketing', 'https://board.zeiras.com/w/acme-marketing/cartelle/3'],
        ['Scrivere il brief', 'https://board.zeiras.com/w/acme-marketing/c/12'],
    ])('scegliere «%s» apre l\'indirizzo del suo prodotto nel workspace dei dati, seguito dal percorso del tipo, anche da un altro prodotto (T5.3)', async (titolo, indirizzo) => {
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
        ['di soli tipi e app che zr-core non conosce', [risultatiDelServer[2], risultatiDelServer[3]]],
    ])('durante l\'attesa la ricerca è in caricamento; con un elenco %s mostra «Nessun risultato per» e la parola (T5.4)', async (_caso, risultati) => {
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
});
