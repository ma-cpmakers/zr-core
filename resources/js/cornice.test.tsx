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
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    // Nessun errore in console, nemmeno un avviso di React (T2.2).
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
});

async function mostra(elemento: ReactElement): Promise<void> {
    await act(async () => radice.render(elemento));
}

async function clic(elemento: Element | null): Promise<void> {
    expect(elemento).not.toBeNull();
    await act(async () => (elemento as HTMLElement).click());
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
