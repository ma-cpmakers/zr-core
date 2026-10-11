import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { IconName } from '../zeiras/index';
import { Cornice } from './cornice';
import { tonoDelWorkspace, type DatiDellaCornice, type GruppoDiVoci } from './index';
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
/**
 * Le aziende della persona in un ordine che non è alfabetico: il workspace dei dati è il secondo della seconda azienda. Gli id
 * dei workspace hanno tre toni diversi (`ws-3` citrus, `ws-2` coral, `ws-4` plum), nessuno dei quali è quello che verrebbe dal
 * nome, dallo slug o dal posto nell'elenco, né quello che il design system mette da sé (pine).
 */
const aziende: NonNullable<DatiDellaCornice['aziende']> = [
    { id: '7', nome: 'Zeta Srl', workspace: [{ id: 'ws-3', nome: 'Ricerca', slug: 'zeta-ricerca' }] },
    { id: '3', nome: 'Acme', workspace: [{ id: 'ws-2', nome: 'Vendite', slug: 'acme-vendite' }, { id: 'ws-4', nome: 'Marketing', slug: 'acme-marketing' }] },
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

/** Il cookie del gettone CSRF che Laravel dà alla pagina; senza valore, scaduto. */
function cookieCsrf(valore?: string): void {
    const nome = 'XSRF-TOKEN';
    document.cookie = valore === undefined ? `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` : `${nome}=${valore}; path=/`;
}

/** Il tracciato dell'icona del design system con quel nome: è ciò che distingue un'icona dall'altra nel DOM. */
function tracciatoDi(icona: IconName): string {
    const svg = Zeiras.Icon({ name: icona }) as ReactElement<{ children: ReactElement<{ d: string }> }>;

    return svg.props.children.props.d;
}

/**
 * Il menu del profilo aperto, nell'ordine in cui sta: di ogni voce ciò che il `Menu` del design system ne rende — il testo, il
 * tracciato dell'icona, `danger`, `disabled` e `hint` — e `null` per una linea.
 */
function vociDelProfilo(): ({ testo: string | null; icona: string | null; pericolo: boolean; spenta: boolean; tasto: string | null } | null)[] {
    return tutti('.zr-profile-menu > [role="menuitem"], .zr-profile-menu > .zr-menu-sep').map((voce) =>
        voce.matches('.zr-menu-sep')
            ? null
            : {
                  testo: voce.querySelector('.zr-menu-label')?.textContent ?? null,
                  icona: voce.querySelector('path')?.getAttribute('d') ?? null,
                  pericolo: voce.classList.contains('is-danger'),
                  spenta: voce.hasAttribute('disabled'),
                  tasto: voce.querySelector('kbd')?.textContent ?? null,
              },
    );
}

/** Una voce del menu del profilo, scelta dal pulsante dell'avatar: il clic chiude il menu, e la volta dopo il pulsante lo riapre. */
async function scegliDalProfilo(nome: string): Promise<void> {
    await clic(uno('.zr-avatar-btn'));
    await clic(tutti('.zr-profile-menu [role="menuitem"]').find((voce) => voce.querySelector('.zr-menu-label')?.textContent === nome) ?? null);
    expect(uno('.zr-profile-menu')).toBeNull();
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

    it('l\'ingresso del pacchetto dà su ogni voce del registro `in_arrivo`: i prodotti che chi non ha una sessione vede «In arrivo», distinti da quelli «Presto» (sprint 16 · T7.3)', async () => {
        const ingresso = await import('./index');

        // Come lo legge una pagina senza sessione: `voce.in_arrivo`, un sì o un no su ogni voce.
        expect(ingresso.registro.filter((voce) => voce.in_arrivo).map((voce) => voce.id)).toStrictEqual(['crm', 'bookings', 'reports', 'automations', 'content']);
        expect(ingresso.registro.filter((voce) => !voce.in_arrivo).map((voce) => voce.id)).toStrictEqual(['home', 'pm']);
        expect(ingresso.registro.map((voce) => typeof voce.in_arrivo)).toStrictEqual(ordine.map(() => 'boolean'));
        // «Presto» è un'altra cosa, e non cambia: CRM e Bookings sono in arrivo senza essere «Presto».
        expect(ingresso.registro.filter((voce) => voce.presto).map((voce) => voce.id)).toStrictEqual(['reports', 'automations', 'content']);
    });

    it.each<[DatiDellaCornice['prodotti'], string[]]>([
        [{ crm: 'attivo', bookings: 'disponibile' }, ['crm', 'bookings']],
        [{ bookings: 'attivo' }, ['bookings']],
        [{ crm: 'disponibile' }, ['crm']],
        [{ crm: 'in_arrivo', bookings: 'in_arrivo' }, []],
    ])('la cornice non legge `in_arrivo` del registro: un prodotto in arrivo per chi non ha una sessione si apre nel workspace dove il backoffice lo dà `attivo` o `disponibile` (sprint 16 · T7.2, %j)', async (prodotti, aperti) => {
        const { registro } = await import('./index');
        // La premessa: per il registro CRM e Bookings sono in arrivo. Se la cornice lo leggesse come «Presto», qui non si aprirebbero.
        expect(registro.filter((voce) => voce.in_arrivo && !voce.presto).map((voce) => voce.id)).toStrictEqual(['crm', 'bookings']);

        await mostra(<Cornice dati={{ ...dati, prodotti }} onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        const voci = tutti('.zr-nav .zr-nav-group a.zr-nav-item').slice(2, 4);
        expect(voci.map((voce) => voce.querySelector('.zr-nav-label')?.textContent)).toStrictEqual(['CRM', 'Bookings']);
        expect(voci.map((voce) => voce.getAttribute('href')))
            .toStrictEqual(['crm', 'bookings'].map((id) => (aperti.includes(id) ? `${indirizzi[id]}/w/acme-marketing` : '#')));
        expect(voci.map((voce) => voce.querySelector('.zr-nav-soon')?.textContent ?? null))
            .toStrictEqual(['crm', 'bookings'].map((id) => (aperti.includes(id) ? null : 'Presto')));
    });

    it.each(['es', 'en'])('con la lingua "%s" nei dati ogni testo della cornice è in quella lingua: nessuno resta italiano (T6.3)', async (lingua) => {
        const attesi = testi(lingua);
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        // Con `piano`: la voce «Piano» è spenta di default (sprint 15 · T1), e il suo testo si legge solo col menu intero.
        await mostra(<Cornice dati={{ ...dati, lingua, aziende, non_lette: 7 }} onLogout={esciSenzaEffetto} crumbs={percorso} create={[{ label: 'Board', icon: 'board' }]} piano />);

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

    it('senza la prop `piano` il menu del profilo è Profilo, Impostazioni, Azienda, una linea, Esci, e «Piano» non c\'è; account, impostazioni e notifiche portano su app.zeiras.com, «Esci» chiama il frontend (linea guida 15; sprint 15 · T1.1)', async () => {
        const naviga = vi.fn();
        const esci = vi.fn();
        await mostra(<Cornice dati={dati} product="bookings" naviga={naviga} onLogout={esci} />);

        expect(uno('.zr-side-foot a.zr-nav-item')?.getAttribute('href')).toBe('https://app.zeiras.com/impostazioni/preferenze');
        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo().map((voce) => voce && voce.testo)).toStrictEqual(['Profilo', 'Impostazioni', 'Azienda', null, 'Esci']);
        await clic(uno('.zr-avatar-btn'));
        expect(uno('.zr-profile-menu')).toBeNull();

        // Ogni voce chiude il menu e porta dove portava.
        await scegliDalProfilo('Profilo');
        await scegliDalProfilo('Impostazioni');
        await scegliDalProfilo('Azienda');
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif .zr-pop-foot button'));
        expect(naviga.mock.calls).toStrictEqual([
            ['https://app.zeiras.com/impostazioni/profilo'],
            ['https://app.zeiras.com/impostazioni/preferenze'],
            ['https://app.zeiras.com/azienda'],
            ['https://app.zeiras.com/notifiche'],
        ]);

        await scegliDalProfilo('Esci');
        expect(esci).toHaveBeenCalledOnce();
        expect(naviga).toHaveBeenCalledTimes(4);
    });

    it('con la prop `piano` il menu del profilo è quello del design system, con «Piano» fra Impostazioni e Azienda: ogni voce porta alla sua pagina su app.zeiras.com, «Piano» a quella del piano, ed «Esci» chiama il frontend (sprint 15 · T1.2)', async () => {
        const naviga = vi.fn();
        const esci = vi.fn();
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={dati} naviga={naviga} onLogout={esci} piano />);

        // La lista è quella che l'`AppShell` mette da sé: la cornice non gliene dà una, e la prop resta alla cornice.
        expect(appShell.mock.lastCall?.[0].accountItems).toBeUndefined();
        expect(Object.keys(appShell.mock.lastCall?.[0] ?? {})).not.toContain('piano');
        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo().map((voce) => voce && voce.testo)).toStrictEqual(['Profilo', 'Impostazioni', 'Piano', 'Azienda', null, 'Esci']);
        await clic(uno('.zr-avatar-btn'));
        expect(uno('.zr-profile-menu')).toBeNull();

        // È il menu di un frontend che ha la pagina del piano: ogni sua voce, non solo «Piano», passa dalla cornice.
        await scegliDalProfilo('Profilo');
        await scegliDalProfilo('Impostazioni');
        await scegliDalProfilo('Piano');
        await scegliDalProfilo('Azienda');
        expect(naviga.mock.calls).toStrictEqual([
            ['https://app.zeiras.com/impostazioni/profilo'],
            ['https://app.zeiras.com/impostazioni/preferenze'],
            ['https://app.zeiras.com/azienda/impostazioni/piano'],
            ['https://app.zeiras.com/azienda'],
        ]);
        expect(esci).not.toHaveBeenCalled();

        await scegliDalProfilo('Esci');
        expect(esci).toHaveBeenCalledOnce();
        expect(naviga).toHaveBeenCalledTimes(4);
    });

    it('il confronto fra i due menu del profilo vede `danger`, `disabled` e `hint` di una voce, come li rende il `Menu` del design system (sprint 15 · T1.3)', async () => {
        const voci = [{ icon: 'arrow', label: 'Esci', danger: true, disabled: true, hint: 'Q' }, { sep: true }, { label: 'Profilo' }];
        await mostra(<Zeiras.Menu anchor={null} inline className="zr-profile-menu" items={voci} onClose={esciSenzaEffetto} />);

        expect(vociDelProfilo()).toStrictEqual([
            { testo: 'Esci', icona: tracciatoDi('arrow'), pericolo: true, spenta: true, tasto: 'Q' },
            null,
            { testo: 'Profilo', icona: null, pericolo: false, spenta: false, tasto: null },
        ]);
    });

    it.each(['it', 'es', 'en'])('senza la prop il menu del profilo è quello che l\'`AppShell` mette da sé, tolta la sola voce «Piano»: stessi testi, stesse icone, stesso ordine, e gli stessi `danger`, `disabled` e `hint`, in "%s" (sprint 15 · T1.3)', async (lingua) => {
        const t = testi(lingua);
        // L'`AppShell` da solo, coi testi della lingua e senza una lista sua: è il menu del design system, che può cambiare.
        await mostra(<Zeiras.AppShell user="Ada Lovelace" labels={t} />);
        await clic(uno('.zr-avatar-btn'));
        const delDesignSystem = vociDelProfilo();
        expect(delDesignSystem.filter((voce) => voce?.testo === t.plan)).toHaveLength(1);

        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toStrictEqual(delDesignSystem.filter((voce) => voce?.testo !== t.plan));
    });
});

// Sprint 3 · T2 (voce #1277). Il selettore «Azienda › workspace» e il numero sulla campanella, dalle aziende e dalle non lette
// dei dati (linea guida 15, passo 8).
describe('il selettore «Azienda › workspace» e la campanella', () => {
    it('in cima alla sidebar azienda e workspace attivo; aperto, ogni azienda coi suoi workspace nell\'ordine dei dati, la ✓ sull\'attivo; senza `nuovo_workspace` nei dati, nessun «Nuovo workspace» (T2.1)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende }} onLogout={esciSenzaEffetto} />);

        const pulsante = uno('.zr-ws-switch');
        expect(pulsante?.querySelector('.zr-ws-company')?.textContent).toBe('Acme');
        expect(pulsante?.querySelector('.zr-ws-name')?.textContent).toBe('Marketing');
        expect(uno('.zr-workspace')).toBeNull();
        // Il tono di ogni workspace viene dal suo id (sprint 17 · T4). Queste aziende non dicono se la persona può creare un
        // workspace, come quelle di una parte server di prima della v1.9.0: nessun «Nuovo workspace» (sprint 19 · T1).
        expect(appShell.mock.lastCall?.[0].companies).toStrictEqual([
            { id: '7', name: 'Zeta Srl', workspaces: [{ slug: 'zeta-ricerca', name: 'Ricerca', tone: 'citrus' }] },
            { id: '3', name: 'Acme', workspaces: [{ slug: 'acme-vendite', name: 'Vendite', tone: 'coral' }, { slug: 'acme-marketing', name: 'Marketing', tone: 'plum' }] },
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

// Sprint 17 · T4 (voce #1633). Nel selettore ogni workspace ha il pallino del suo tono, e il tono lo decide la regola di zr-core
// dall'id del workspace (`tonoDelWorkspace`): non dal nome, dallo slug o dal posto nell'elenco, che cambiano. Un workspace senza
// id — i dati scritti a mano nei test di un frontend — non ha tono: il pallino resta quello che il design system mette da sé.
describe('il colore di ogni workspace nel selettore', () => {
    type Aziende = NonNullable<DatiDellaCornice['aziende']>;
    const [zeta, acme] = aziende;
    const [vendite, marketing] = acme.workspace;

    /** Il colore del pallino di ogni workspace nel selettore aperto, per nome: com'è scritto nel suo stile. */
    function pallini(): Record<string, string | null> {
        return Object.fromEntries(
            tutti('.zr-ws-menu .zr-ws-item').map((voce) => [voce.querySelector('.zr-nav-label')?.textContent ?? '', voce.querySelector('.zr-ws-dot')?.getAttribute('style') ?? null]),
        );
    }

    it('ogni workspace ha il pallino del suo tono, quello che la regola esportata dà per il suo id (sprint 17 · T4.1, T4.6)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende }} onLogout={esciSenzaEffetto} />);

        expect(appShell.mock.lastCall?.[0].companies?.map((azienda) => azienda.workspaces.map((ws) => ws.tone))).toStrictEqual([['citrus'], ['coral', 'plum']]);
        // Lo stesso tono che la regola esportata dà a chi mostra un workspace fuori dalla cornice.
        expect(aziende.map((azienda) => azienda.workspace.map((ws) => tonoDelWorkspace(ws.id)))).toStrictEqual([['citrus'], ['coral', 'plum']]);

        await clic(uno('.zr-ws-switch'));
        expect(pallini()).toStrictEqual({ Ricerca: 'background: var(--citrus);', Vendite: 'background: var(--coral);', Marketing: 'background: var(--plum);' });
    });

    it.each<[string, Aziende, string]>([
        ['con un altro nome', [zeta, { ...acme, workspace: [vendite, { ...marketing, nome: 'Marketing Europa' }] }], 'acme-marketing'],
        ['con un altro slug', [zeta, { ...acme, workspace: [vendite, { ...marketing, slug: 'acme-europa' }] }], 'acme-europa'],
        ['con un workspace in più prima di lui, e la sua azienda per prima', [{ ...acme, workspace: [{ id: 'ws-9', nome: 'Assistenza', slug: 'acme-assistenza' }, vendite, marketing] }, zeta], 'acme-marketing'],
        ['da solo nella sua azienda', [{ ...acme, workspace: [marketing] }], 'acme-marketing'],
    ])('%s il workspace «ws-4» ha lo stesso tono (sprint 17 · T4.1)', async (_caso, aziendeDeiDati, slug) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, workspace: { nome: 'Marketing', slug }, aziende: aziendeDeiDati }} onLogout={esciSenzaEffetto} />);

        const workspace = appShell.mock.lastCall?.[0].companies?.flatMap((azienda) => azienda.workspaces).filter((ws) => ws.slug === slug);
        expect(workspace?.map((ws) => ws.tone)).toStrictEqual(['plum']);
    });

    it('lo stesso nome, lo stesso slug e lo stesso posto con un altro id: un altro tono (sprint 17 · T4.1)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende: [zeta, { ...acme, workspace: [vendite, { ...marketing, id: 'ws-5' }] }] }} onLogout={esciSenzaEffetto} />);

        expect(appShell.mock.lastCall?.[0].companies?.map((azienda) => azienda.workspaces.map((ws) => ws.tone))).toStrictEqual([['citrus'], ['coral', 'sky']]);
    });

    it.each<[string, unknown]>([
        ['senza id', undefined],
        ['con un id vuoto', ''],
        ['con un id che non è un testo', 5],
        ['con un id null', null],
    ])('un workspace %s non ha tono, e il suo pallino è quello che il design system mette da sé; gli altri hanno il loro (sprint 17 · T4.4)', async (_caso, id) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        // Nome e slug sono testi che come id avrebbero un tono (sky e coral): senza id non se ne ricava uno da lì, né dal posto.
        const senzaId = { nome: 'ws-5', slug: 'ws-2', ...(id === undefined ? {} : { id: id as string }) };
        await mostra(<Cornice dati={{ ...dati, aziende: [{ ...acme, workspace: [marketing, senzaId] }] }} onLogout={esciSenzaEffetto} />);

        expect(appShell.mock.lastCall?.[0].companies).toStrictEqual([
            { id: '3', name: 'Acme', workspaces: [{ slug: 'acme-marketing', name: 'Marketing', tone: 'plum' }, { slug: 'ws-2', name: 'ws-5' }] },
        ]);
        await clic(uno('.zr-ws-switch'));
        expect(pallini()).toStrictEqual({ Marketing: 'background: var(--plum);', 'ws-5': 'background: var(--pine);' });
    });

    it('nel tipo dei dati l\'id di un workspace è facoltativo: i dati di un frontend che non lo danno restano validi, lo guarda tsc (sprint 17 · T4.5)', () => {
        expectTypeOf<{ nome: string; slug: string }>().toExtend<Aziende[number]['workspace'][number]>();
        expectTypeOf<Aziende[number]['workspace'][number]['id']>().toEqualTypeOf<string | undefined>();
    });
});

// Sprint 19 · T1 (voce #1669). «Nuovo workspace» in fondo al selettore. La parte server dice per ogni azienda se la persona può
// crearvi un workspace (`nuovo_workspace`: un booleano, il ruolo non arriva al browser), e conta l'azienda del workspace dei dati,
// quella che l'`AppShell` mostra in cima al selettore. Il pulsante apre la pagina di zr-home nel workspace dei dati: una pagina di
// app.zeiras.com da ogni prodotto. Il pulsante, il suo testo e la sua icona sono dell'`AppShell`: la cornice gli dà solo che cosa
// fare al clic.
describe('«Nuovo workspace» in fondo al selettore', () => {
    type Aziende = NonNullable<DatiDellaCornice['aziende']>;
    const [zeta, acme] = aziende;
    /** La persona può creare un workspace in Acme, l'azienda del workspace dei dati, e non in Zeta. */
    const soloInAcme: Aziende = [{ ...zeta, nuovo_workspace: false }, { ...acme, nuovo_workspace: true }];
    /** Acme una seconda volta, con un altro id e un altro nome: il workspace dei dati sta in due aziende. */
    const holding = { ...acme, id: '9', nome: 'Acme Holding' };

    it.each([
        ['it', 'Nuovo workspace'],
        ['es', 'Nuevo workspace'],
        ['en', 'New workspace'],
    ])('con `nuovo_workspace` vero nell\'azienda del workspace dei dati, in %s il selettore aperto finisce con una riga di separazione e col pulsante «%s», col «+» (sprint 19 · T1.2)', async (lingua, testo) => {
        await mostra(<Cornice dati={{ ...dati, lingua, aziende: soloInAcme }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-ws-switch'));
        // In fondo: dopo l'ultima azienda la riga di separazione, e per ultimo il pulsante.
        const figli = [...(uno('.zr-ws-menu')?.children ?? [])];
        expect(figli.map((figlio) => figlio.className)).toStrictEqual(['zr-ws-group', 'zr-ws-group', 'zr-product-sep', 'zr-ws-item zr-ws-new']);
        expect(figli[2].getAttribute('role')).toBe('separator');
        const pulsante = figli[3];
        expect([pulsante.tagName, pulsante.getAttribute('type')]).toStrictEqual(['BUTTON', 'button']);
        expect(pulsante.querySelector('.zr-nav-label')?.textContent).toBe(testo);
        expect(pulsante.querySelector('svg path')?.getAttribute('d')).toBe(tracciatoDi('plus'));
    });

    it.each<[string, Aziende]>([
        ['falso lì e vero in un\'altra', [{ ...zeta, nuovo_workspace: true }, { ...acme, nuovo_workspace: false }]],
        ['assente lì e vero in un\'altra', [{ ...zeta, nuovo_workspace: true }, acme]],
        // Solo il booleano `true` apre: nei dati composti a mano un altro valore vale «no».
        ['il testo «true» lì', [zeta, { ...acme, nuovo_workspace: 'true' as unknown as boolean }]],
        ['il numero 1 lì', [zeta, { ...acme, nuovo_workspace: 1 as unknown as boolean }]],
        ['un ruolo al posto del booleano lì', [zeta, { ...acme, nuovo_workspace: 'proprietario' as unknown as boolean }]],
        // Lo stesso workspace in due aziende: l'`AppShell` mostra in cima l'ultima, e conta quella.
        ['vero nella prima delle due aziende che hanno quel workspace e falso nell\'ultima', [{ ...holding, nuovo_workspace: true }, { ...acme, nuovo_workspace: false }]],
    ])('con `nuovo_workspace` %s, nell\'azienda del workspace dei dati il pulsante non c\'è (sprint 19 · T1.2)', async (_caso, aziendeDeiDati) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende: aziendeDeiDati }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe('Acme');
        expect(appShell.mock.lastCall?.[0].onNewWorkspace).toBeUndefined();
        await clic(uno('.zr-ws-switch'));
        expect([...(uno('.zr-ws-menu')?.children ?? [])].map((figlio) => figlio.className)).toStrictEqual(['zr-ws-group', 'zr-ws-group']);
    });

    it('con lo stesso workspace in due aziende, falso nella prima e vero nell\'ultima, il pulsante c\'è: conta quella che l\'`AppShell` mostra in cima (sprint 19 · T1.2)', async () => {
        await mostra(<Cornice dati={{ ...dati, aziende: [{ ...holding, nuovo_workspace: false }, { ...acme, nuovo_workspace: true }] }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe('Acme');
        await clic(uno('.zr-ws-switch'));
        expect(tutti('.zr-ws-menu > .zr-ws-new')).toHaveLength(1);
    });

    it.each<[string, DatiDellaCornice['aziende']]>([
        ['con un elenco vuoto', []],
        ['col workspace dei dati in nessuna azienda', [{ ...zeta, nuovo_workspace: true }, { id: '3', nome: 'Acme', workspace: [{ nome: 'Vendite', slug: 'acme-vendite' }], nuovo_workspace: true }]],
    ])('%s il workspace resta testo e la cornice non dà «Nuovo workspace» all\'`AppShell`, nemmeno se ogni azienda lo permette (sprint 19 · T1.2)', async (_caso, aziendeDeiDati) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende: aziendeDeiDati }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-workspace')?.textContent).toBe('Marketing');
        expect(uno('.zr-ws-switch')).toBeNull();
        expect(appShell.mock.lastCall?.[0].onNewWorkspace).toBeUndefined();
    });

    it.each([[undefined], ['pm'], ['bookings'], ['board']])('con product=%s un clic apre la pagina di zr-home nel workspace dei dati, su app.zeiras.com, una volta sola, e chiude il selettore (sprint 19 · T1.3)', async (product) => {
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, aziende: soloInAcme }} product={product} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-ws-switch'));
        await clic(uno('.zr-ws-new'));
        // Lo slug dei dati, non quello di un altro workspace dell'elenco (`zeta-ricerca`, `acme-vendite`).
        expect(naviga.mock.calls).toStrictEqual([['https://app.zeiras.com/w/acme-marketing/nuovo-workspace']]);
        expect(uno('.zr-ws-menu')).toBeNull();
    });

    it('lo slug del workspace dei dati entra nell\'indirizzo codificato (sprint 19 · T1.3)', async () => {
        const naviga = vi.fn();
        const slug = 'acme marketing/è?#';
        const conQuelloSlug: Aziende = [zeta, { ...acme, workspace: [acme.workspace[0], { ...acme.workspace[1], slug }], nuovo_workspace: true }];
        await mostra(<Cornice dati={{ ...dati, workspace: { nome: 'Marketing', slug }, aziende: conQuelloSlug }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-ws-switch'));
        await clic(uno('.zr-ws-new'));
        expect(naviga.mock.calls).toStrictEqual([['https://app.zeiras.com/w/acme%20marketing%2F%C3%A8%3F%23/nuovo-workspace']]);
    });

    it('nel tipo dei dati `nuovo_workspace` è un booleano facoltativo: le aziende di una parte server di prima restano valide, lo guarda tsc (sprint 19 · T1.2)', () => {
        expectTypeOf<{ id: string; nome: string; workspace: { nome: string; slug: string }[] }>().toExtend<Aziende[number]>();
        expectTypeOf<Aziende[number]['nuovo_workspace']>().toEqualTypeOf<boolean | undefined>();
    });
});

// Sprint 3 · T4 (voce #1277), riscritto nello sprint 5 · T3 (voce #1257). Il pannello delle notifiche coi dati di
// GET /cornice/notifiche, e dove portano una notifica e «Vedi tutte» (linea guida 15, passo 10). Sprint 6 · T3 e T4 (voce
// #1318): una notifica è `{id, creata_il, letta, app}`, e di che prodotto è lo dice il registro, da `app` (per chi è, il
// contratto non lo dice); «Segna tutte come lette» è una POST /cornice/notifiche/letture sola, fino alla `creata_il` più recente
// fra le caricate. Sprint 12 · T3 (voce #1463): una notifica porta anche `tipo`, e il suo titolo è quello del tipo, dalle lingue;
// un tipo che zr-core non conosce ha il titolo di ripiego. Con una sola non letta la campanella dice il singolare.
describe('il pannello delle notifiche', () => {
    /** Le notifiche come le dà GET /cornice/notifiche, dalla più recente; «adesso» è il 6 ottobre 2026 alle 12:00 UTC. */
    const adesso = new Date('2026-10-06T12:00:00Z');
    const notificheDelServer = [
        { id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm' },
        { id: 'uat-n40', creata_il: '2026-10-05T12:00:00Z', letta: false, app: 'crm' },
        { id: 'uat-n39', creata_il: '2026-10-01T09:00:00Z', letta: true, app: null },
    ];
    /** Le stesse, già lette: le non lette dei dati stanno oltre la prima pagina. */
    const tutteLette = notificheDelServer.map((notifica) => ({ ...notifica, letta: true }));
    /** Una notifica nata in quell'istante. */
    const nata = (id: string, creataIl: string, letta = false) => ({ id, creata_il: creataIl, letta, app: null });
    /**
     * Una notifica per ogni caso di `app`, dalla più recente. Prima i prodotti del registro: uno attivo nel workspace dei dati
     * (`pm`), uno solo disponibile (`crm`), uno «Presto» per il registro (`reports`), uno che i dati non elencano (`content`). Poi
     * ciò che non è un prodotto: `null`, un codice che il registro non ha, la Dashboard. Il `tipo` dà il titolo, non il prodotto:
     * due notifiche hanno il tipo di una cartella di Project Management, una con `app` `crm` e una che non è di un'app, e il
     * prodotto resta quello di `app`; le altre non hanno `tipo`, e hanno il titolo di ripiego. `soggetto` e i campi della bozza
     * (`per_me`, `motivo`) la parte server non li dà: se arrivassero lo stesso il pannello non li userebbe.
     */
    const diOgniApp = [
        { id: 'uat-n47', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm', per_me: true, motivo: 'menzione' },
        { id: 'uat-n46', creata_il: '2026-10-05T12:00:00Z', letta: false, app: 'crm', per_me: false, tipo: 'com.zeiras.board.cartella.creata', soggetto: '/v1/board/cartelle/uat-cartella-1' },
        { id: 'uat-n45', creata_il: '2026-10-01T09:00:00Z', letta: true, app: 'reports' },
        { id: 'uat-n44', creata_il: '2026-10-01T09:00:00Z', letta: false, app: 'content' },
        { id: 'uat-n43', creata_il: '2026-10-01T09:00:00Z', letta: true, app: null, tipo: 'com.zeiras.board.cartella.creata', soggetto: '/v1/board/cartelle/uat-cartella-2' },
        { id: 'uat-n42', creata_il: '2026-10-01T09:00:00Z', letta: false, app: 'uat-ignota' },
        { id: 'uat-n41', creata_il: '2026-10-01T09:00:00Z', letta: true, app: 'home' },
    ];

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(adesso);
    });

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
    /** Il corpo JSON di una richiesta partita. */
    const corpoDi = (opzioni?: RequestInit) => JSON.parse(String(opzioni?.body)) as { fino_a?: unknown; workspace?: unknown };
    /** La risposta della parte server a «Segna tutte come lette»: l'istante chiesto, come lo dà il backoffice (in UTC). */
    const segnateFinoA = (opzioni?: RequestInit) => risposta({ data: { fino_a: new Date(String(corpoDi(opzioni).fino_a)).toISOString() } });
    /** Le due rotte che rispondono subito: l'elenco dato, e ogni «Segna tutte come lette» riuscita. */
    const rotte = (elenco: unknown[]) => vi.fn(async (indirizzo: string, opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: elenco }) : segnateFinoA(opzioni)));

    it.each([
        ['it', ['Novità nel workspace', 'Nuova cartella'], ['5 minuti fa', 'ieri', '1 ott'], ['Project Management', 'CRM', 'Report', 'Contenuti']],
        ['es', ['Novedades en el workspace', 'Nueva carpeta'], ['hace 5 minutos', 'ayer', '1 oct'], ['Gestión de proyectos', 'CRM', 'Informes', 'Contenidos']],
        ['en', ['News in the workspace', 'New folder'], ['5 minutes ago', 'yesterday', 'Oct 1'], ['Project Management', 'CRM', 'Reports', 'Content']],
        // Come la scrive un sistema: la lingua è la stessa, e `Intl` non la rifiuta.
        ['it_IT', ['Novità nel workspace', 'Nuova cartella'], ['5 minuti fa', 'ieri', '1 ott'], ['Project Management', 'CRM', 'Report', 'Contenuti']],
    ])('con la lingua "%s", aprendo la campanella il pannello è in caricamento, poi mostra ogni notifica col titolo del suo tipo nella lingua, o quello di ripiego, e l\'ora: quella di un prodotto del registro col suo nome nella lingua, la sua icona e il suo tono, le altre senza prodotto, tutte in «Per me» come in «Tutte» (sprint 5 · T3.1; sprint 6 · T3.1-T3.3; sprint 12 · T3.1, T3.2)', async (lingua, [diRipiego, dellaCartella], [pocoFa, ieri, giorniFa], [pm, crm, reports, content]) => {
        const elenco = inAttesa();
        const fetchFinto = vi.fn((_indirizzo: string, _opzioni?: RequestInit) => elenco.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 4 }} onLogout={esciSenzaEffetto} />);
        // Non con la pagina: il numero sulla campanella viene dai dati.
        expect(fetchFinto).not.toHaveBeenCalled();

        await clic(uno('.zr-bell'));
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
        expect(uno('.zr-notif [role="status"]')).not.toBeNull();
        expect(uno('.zr-notif-list')).toBeNull();

        await elenco.arriva(risposta({ data: diOgniApp }));
        expect(uno('.zr-notif [role="status"]')).toBeNull();
        // «Per me», poi «Tutte»: le stesse notifiche, anche quella che la bozza dava per altri.
        expect(tutti('.zr-notif-tabs [role="tab"]')).toHaveLength(2);
        for (const scheda of [0, 1]) {
            await clic(tutti('.zr-notif-tabs [role="tab"]')[scheda]);
            expect(tutti('.zr-notif-tabs [role="tab"]').map((voce) => voce.getAttribute('aria-selected'))).toStrictEqual(scheda === 0 ? ['true', 'false'] : ['false', 'true']);
            // Riga per riga: il titolo del tipo dove il tipo c'è (la seconda e la quinta), quello di ripiego dove manca.
            expect(voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent)).toStrictEqual([
                diRipiego, dellaCartella, diRipiego, diRipiego, dellaCartella, diRipiego, diRipiego,
            ]);
            // Il nome del prodotto nella lingua dei dati davanti all'ora, anche se è «Presto» o non è attivo nel workspace: viene
            // da `app`, non dal `tipo`. Senza un prodotto del registro, solo l'ora: mai il codice, mai la Dashboard.
            expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual([
                `${pm} · ${pocoFa}`, `${crm} · ${ieri}`, `${reports} · ${giorniFa}`, `${content} · ${giorniFa}`, giorniFa, giorniFa, giorniFa,
            ]);
            expect(nonLette()).toStrictEqual([true, true, false, true, false, true, false]);
            expect(voci().map((voce) => voce.querySelectorAll('.zr-notif-dot').length)).toStrictEqual([1, 1, 0, 1, 0, 1, 0]);
            // Icona e tono del prodotto, dal registro; senza prodotto, la campanella e il tono neutro del design system.
            expect(voci().map((voce) => voce.querySelector('.zr-iconbox path')?.getAttribute('d'))).toStrictEqual(
                (['board', 'users', 'chart', 'sparkle', 'bell', 'bell', 'bell'] as const).map(tracciatoDi),
            );
            expect(voci().map(tono)).toStrictEqual(['zr-label-pine', 'zr-label-sky', 'zr-label-citrus', 'zr-label-coral', 'zr-label-neutral', 'zr-label-neutral', 'zr-label-neutral']);
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

    it('«Segna tutte come lette» manda una sola POST /cornice/notifiche/letture, col gettone CSRF e la creata_il più recente fra le caricate così com\'è, e nessuna PATCH; alla risposta le caricate sono tutte lette e la campanella non ha più un numero, anche con 60 nei dati e 2 caricate (sprint 6 · T4.1)', async () => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        const lettura = inAttesa();
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer }) : lettura.promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('60');

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        const [, opzioni] = fetchFinto.mock.calls[1];
        expect(new Headers(opzioni?.headers).get('X-XSRF-TOKEN')).toBe('eyJpdiI6Ik1h==');
        expect(new Headers(opzioni?.headers).get('Content-Type')).toBe('application/json');
        // Com'è nell'elenco, col suo fuso: né l'ora del browser («adesso» sono le 12:00) né l'istante riscritto.
        expect(corpoDi(opzioni)).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        // Prima della risposta non cambia niente, e un altro clic non manda una seconda richiesta.
        expect(campanella()).toBe('60');
        expect(nonLette()).toStrictEqual([true, true, false]);
        await clic(segnaTutte());
        expect(fetchFinto).toHaveBeenCalledTimes(2);

        await lettura.arriva(risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' } }));
        // 60 nei dati e 2 non lette caricate: nessun numero, non 58.
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(segnaTutte()).toBeNull();
        // Nessuna PATCH, e l'elenco non si ricarica: nel frattempo nessuno l'ha ricaricato.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
    });

    it.each<[string, ReturnType<typeof nata>[], string]>([
        ['non è la prima dell\'elenco', [nata('uat-a', '2026-10-06T09:00:00Z'), nata('uat-b', '2026-10-06T11:00:00Z'), nata('uat-c', '2026-10-06T10:00:00Z')], '2026-10-06T11:00:00Z'],
        // Le 12:30 a +02:00 sono le 10:30 UTC: come stringa quella notifica verrebbe dopo le 11:00 UTC, come istante viene prima.
        ['viene dopo, come stringa, di un\'altra con un altro fuso', [nata('uat-a', '2026-10-06T12:30:00+02:00'), nata('uat-b', '2026-10-06T11:00:00Z')], '2026-10-06T11:00:00Z'],
        // Le 06:30 a -05:00 sono le 11:30 UTC: come stringa verrebbe prima delle 11:00 UTC, come istante viene dopo.
        ['ha un fuso che, come stringa, la mette prima', [nata('uat-a', '2026-10-06T11:00:00Z'), nata('uat-b', '2026-10-06T06:30:00-05:00')], '2026-10-06T06:30:00-05:00'],
        ['è già letta', [nata('uat-a', '2026-10-06T11:00:00Z', true), nata('uat-b', '2026-10-06T10:00:00Z')], '2026-10-06T11:00:00Z'],
    ])('«Segna tutte come lette» manda l\'istante più avanti fra le notifiche caricate, com\'è, anche se la più recente %s (sprint 6 · T4.1)', async (_caso, elenco, attesa) => {
        const fetchFinto = rotte(elenco);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 3 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[1][1])).toStrictEqual({ fino_a: attesa, workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual(elenco.map(() => false));
    });

    it('con 12 non lette nei dati e le notifiche caricate tutte lette il pulsante c\'è: le non lette stanno oltre la prima pagina, e il clic le segna con la stessa richiesta (sprint 6 · T4.2)', async () => {
        const fetchFinto = rotte(tutteLette);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('12');
        expect(nonLette()).toStrictEqual([false, false, false]);

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[1][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();
    });

    it('senza aver aperto la campanella «Segna tutte come lette» non c\'è, anche con 12 non lette nei dati (sprint 5 · T3.5; sprint 6 · T4.2)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        const fetchFinto = rotte(notificheDelServer);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);

        expect(campanella()).toBe('12');
        expect(appShell.mock.lastCall?.[0].onMarkAllRead).toBeUndefined();
        // Il numero viene dai dati: l'elenco non si carica con la pagina.
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    it.each<[string, number | undefined, () => Promise<Response>]>([
        ['in caricamento', 12, () => new Promise<Response>(() => {})],
        ['in errore', 12, async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['senza notifiche', 12, async () => risposta({ data: [] })],
        // La campanella senza numero: nei dati zero, o nessun numero, e le notifiche caricate tutte lette.
        ['con le notifiche tutte lette e zero non lette nei dati', 0, async () => risposta({ data: tutteLette })],
        ['con le notifiche tutte lette e nessun numero nei dati', undefined, async () => risposta({ data: tutteLette })],
    ])('col pannello %s «Segna tutte come lette» non c\'è (sprint 5 · T3.5; sprint 6 · T4.2)', async (_caso, nonLetteNeiDati, elenco) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        vi.stubGlobal('fetch', vi.fn(elenco));
        await mostra(<Cornice dati={{ ...dati, non_lette: nonLetteNeiDati }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif .zr-pop-head')).not.toBeNull();
        expect(segnaTutte()).toBeNull();
        expect(appShell.mock.lastCall?.[0].onMarkAllRead).toBeUndefined();
        expect(campanella()).toBe(nonLetteNeiDati ? String(nonLetteNeiDati) : null);
    });

    it.each<[string, () => Promise<Response>]>([
        ['una risposta 502', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['un 422', async () => risposta({ errore: 'dati_non_validi' }, 422)],
        // Sprint 16 · T4.3: il lock della sessione è di un'altra richiesta. Il corpo è un testo, non JSON: leggerlo come JSON lancia.
        ['il 503 del blocco della sessione', async () => ({ ok: false, status: 503, json: async () => { throw new SyntaxError('Unexpected token'); } }) as unknown as Response],
        ['la rete giù', async () => { throw new TypeError('Failed to fetch'); }],
        ['un 200 senza l\'istante', async () => risposta({ data: {} })],
        ['un 200 con un istante che non è una stringa', async () => risposta({ data: { fino_a: 1 } })],
        ['un 200 senza dati', async () => risposta({})],
    ])('se la richiesta fallisce con %s non cambia niente: le notifiche restano non lette, il numero e il pulsante restano, e un altro clic riprova con una richiesta nuova (sprint 6 · T4.3)', async (_caso, fallisce) => {
        const fetchFinto = vi.fn<(indirizzo: string, opzioni?: RequestInit) => Promise<Response>>()
            .mockImplementationOnce(async () => risposta({ data: notificheDelServer }))
            .mockImplementationOnce(fallisce)
            .mockImplementation(async (_indirizzo, opzioni) => segnateFinoA(opzioni));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(campanella()).toBe('12');
        expect(nonLette()).toStrictEqual([true, true, false]);
        expect(segnaTutte()).not.toBeNull();

        await clic(segnaTutte());
        expect(richieste(fetchFinto).slice(2)).toStrictEqual(['POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[2][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
    });

    it('dopo «Segna tutte come lette» la campanella resta senza numero finché la pagina ha gli stessi dati; coi dati nuovi della parte server mostra il loro numero, anche se è lo stesso (sprint 5 · T3.4; sprint 6 · T4.4)', async () => {
        vi.stubGlobal('fetch', rotte(notificheDelServer));
        const primi = { ...dati, non_lette: 12 };
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();

        // La stessa pagina ridisegnata con gli stessi dati: la campanella resta senza numero.
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();

        // Una visita dopo (Inertia tiene montata la cornice): i dati nuovi contano già le lette, anche se il numero è lo stesso.
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');
    });

    it('se i dati nuovi arrivano fra il clic e la risposta, alla risposta la campanella mostra il loro numero: l\'azzeramento vale per i dati del clic, non per il numero (sprint 6 · T4.4)', async () => {
        const lettura = inAttesa();
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer }) : lettura.promessa)));
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());

        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await lettura.arriva(risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' } }));
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(campanella()).toBe('12');
    });

    it.each<[number | undefined]>([
        // Meno non lette nei dati di quelle caricate: una è arrivata dopo che la parte server ha contato.
        [1],
        [0],
        // Senza il numero nei dati il design system conta le non lette caricate.
        [undefined],
    ])('con %s non lette nei dati e due caricate la campanella mostra 2, mai meno delle caricate; segnate, non ha più un numero (sprint 6 · T4.5)', async (nonLetteNeiDati) => {
        const fetchFinto = rotte(notificheDelServer);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: nonLetteNeiDati }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');

        await clic(segnaTutte());
        expect(richieste(fetchFinto).slice(1)).toStrictEqual(['POST /cornice/notifiche/letture']);
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
    });

    it('dopo «Segna tutte come lette», riaprendo il pannello con una notifica nuova non letta la campanella mostra 1, la notifica è non letta, il pulsante c\'è e il clic manda la sua creata_il (sprint 6 · T4.5)', async () => {
        const nuova = nata('uat-n42', '2026-10-06T11:59:30.250Z');
        const fetchFinto = vi.fn<(indirizzo: string, opzioni?: RequestInit) => Promise<Response>>()
            .mockImplementationOnce(async () => risposta({ data: notificheDelServer }))
            .mockImplementationOnce(async (_indirizzo, opzioni) => segnateFinoA(opzioni))
            .mockImplementationOnce(async () => risposta({ data: [nuova, ...tutteLette] }))
            .mockImplementation(async (_indirizzo, opzioni) => segnateFinoA(opzioni));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();

        // Chiuso e riaperto: l'elenco si ricarica, e c'è una notifica arrivata dopo, più recente del `fino_a` mandato.
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')).toBeNull();
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('1');
        expect(nonLette()).toStrictEqual([true, false, false, false]);

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[3][1])).toStrictEqual({ fino_a: '2026-10-06T11:59:30.250Z', workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false, false]);
    });

    it.each<[number, string | null]>([
        [0, null],
        [1, '1'],
    ])('coi dati nuovi della parte server a %s non lette non contano più le due non lette di un elenco caricato coi dati di prima: è più vecchio del loro numero (sprint 6 · T4.5)', async (nonLetteNuove, attesa) => {
        vi.stubGlobal('fetch', rotte(notificheDelServer));
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')).toBeNull();
        expect(campanella()).toBe('2');

        // Una visita dopo, con la cornice montata: la persona le ha lette altrove, e i dati nuovi lo sanno.
        await mostra(<Cornice dati={{ ...dati, non_lette: nonLetteNuove }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe(attesa);
    });

    it('riaprendo il pannello la campanella tiene le non lette dell\'ultimo elenco arrivato mentre il nuovo si carica, e anche se il caricamento fallisce (sprint 6 · T4.5)', async () => {
        const secondo = inAttesa();
        const fetchFinto = vi.fn<(indirizzo: string, opzioni?: RequestInit) => Promise<Response>>()
            .mockImplementationOnce(async () => risposta({ data: notificheDelServer }))
            .mockImplementationOnce(() => secondo.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 0 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');

        // Chiuso e riaperto: mentre il nuovo elenco si carica il pannello è vuoto, ma le due non lette di prima contano ancora.
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(voci()).toHaveLength(0);
        expect(campanella()).toBe('2');

        await secondo.arriva(risposta({ errore: 'backoffice_non_risponde' }, 502));
        expect(voci()).toHaveLength(0);
        expect(campanella()).toBe('2');
    });

    it('se i dati sono cambiati a pannello aperto l\'elenco è più vecchio dei dati: alla risposta di «Segna tutte come lette» si ricarica, e la campanella mostra la non letta arrivata dopo (sprint 6 · T4.6)', async () => {
        const nuova = nata('uat-n42', '2026-10-06T11:59:30.250Z');
        const elenchi = [notificheDelServer, [nuova, ...tutteLette]];
        let chiesti = 0;
        const fetchFinto = vi.fn(async (indirizzo: string, opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: elenchi[chiesti++] }) : segnateFinoA(opzioni)));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        // I dati nuovi arrivano col pannello aperto (una visita, con la cornice montata), e contano una notifica in più.
        await mostra(<Cornice dati={{ ...dati, non_lette: 3 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('3');

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(corpoDi(fetchFinto.mock.calls[1][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(nonLette()).toStrictEqual([true, false, false, false]);
        expect(campanella()).toBe('1');
    });

    it('se il pannello è stato ricaricato fra il clic e la risposta, alla risposta le non lette di quell\'elenco non contano più sulla campanella, nemmeno mentre il nuovo si carica o se il caricamento fallisce: la lettura le ha coperte (sprint 6 · T4.6)', async () => {
        const lettura = inAttesa();
        const terzo = inAttesa();
        // Il primo elenco, quello chiesto riaprendo prima della risposta (ancora non lette), quello chiesto dopo.
        const elenchi = [async () => risposta({ data: notificheDelServer }), async () => risposta({ data: notificheDelServer }), () => terzo.promessa];
        let chiesti = 0;
        vi.stubGlobal('fetch', vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? elenchi[chiesti++]() : lettura.promessa)));
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('12');

        await lettura.arriva(risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' } }));
        expect(campanella()).toBeNull();

        await terzo.arriva(risposta({ errore: 'backoffice_non_risponde' }, 502));
        expect(campanella()).toBeNull();
    });

    it('se i dati passano a un altro workspace a pannello aperto, «Segna tutte come lette» manda lo slug del workspace per cui l\'elenco è stato chiesto, non quello dei dati nuovi: l\'istante è delle sue notifiche (sprint 6 · T4.1, T2.5)', async () => {
        const fetchFinto = rotte(notificheDelServer);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        // La cornice resta montata e i dati sono di un altro workspace: l'elenco in pagina è ancora quello di prima.
        await mostra(<Cornice dati={{ ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' }, non_lette: 5 }} onLogout={esciSenzaEffetto} />);
        await clic(segnaTutte());
        expect(richieste(fetchFinto).slice(0, 2)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[1][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
    });

    it('se fra il clic e la risposta il pannello è stato ricaricato, alla risposta l\'elenco si ricarica ancora una volta: in pagina non resta un elenco chiesto prima della lettura (sprint 6 · T4.6)', async () => {
        const lettura = inAttesa();
        // Il primo elenco, quello chiesto riaprendo prima della risposta (ancora non lette), quello chiesto dopo.
        const elenchi = [notificheDelServer, notificheDelServer, tutteLette];
        let chiesti = 0;
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: elenchi[chiesti++] }) : lettura.promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 12 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());

        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(nonLette()).toStrictEqual([true, true, false]);

        await lettura.arriva(risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' } }));
        expect(richieste(fetchFinto).slice(3)).toStrictEqual(['GET /cornice/notifiche']);
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(campanella()).toBeNull();
    });

    // Sprint 11 · T2 (voce #1458). I dati della parte server portano un segno, l'istante in cui sono stati letti, e le due rotte
    // dicono quando l'elenco è stato letto e quando la lettura è stata segnata: la cornice li confronta, e non torna a ciò che è
    // più vecchio. Qui i dati arrivano alla `Cornice` come glieli dà la pagina, uno dopo l'altro.

    /** Un istante della parte server nella forma del segno: il 6 ottobre 2026 alle 12:00 e `secondi`, in UTC coi microsecondi. */
    const alSecondo = (secondi: number) => `2026-10-06T12:00:${String(secondi).padStart(2, '0')}.123456Z`;
    /** I dati di una lettura della parte server: il segno (o nessuno, come nella `v1.2.0`) e le non lette contate allora. */
    const letti = (il: string | undefined, nonLetteContate: number, altro: Partial<DatiDellaCornice> = {}): DatiDellaCornice => ({
        ...dati,
        non_lette: nonLetteContate,
        ...(il === undefined ? {} : { aggiornati_il: il }),
        ...altro,
    });
    /** Le due rotte con gli istanti della parte server: l'elenco letto in `lettoIl`, la lettura segnata in `segnateIl`. Senza un istante, la risposta è quella della `v1.2.1`. */
    const rotteConGliIstanti = (elenco: unknown[], { lettoIl, segnateIl }: { lettoIl?: string; segnateIl?: string }) =>
        vi.fn(async (indirizzo: string, opzioni?: RequestInit) =>
            indirizzo === '/cornice/notifiche'
                ? risposta({ data: elenco, ...(lettoIl === undefined ? {} : { aggiornati_il: lettoIl }) })
                : risposta({ data: { fino_a: new Date(String(corpoDi(opzioni).fino_a)).toISOString() }, ...(segnateIl === undefined ? {} : { segnate_il: segnateIl }) }),
        );
    const vendite = { workspace: { nome: 'Vendite', slug: 'acme-vendite' } };
    const nomeDelWorkspace = () => uno('.zr-workspace')?.textContent ?? null;

    it('la cornice tiene i dati più recenti che ha visto: dati dello stesso workspace con un segno più indietro non cambiano il numero né il nome del workspace; con un segno più avanti valgono, anche col numero più basso (sprint 11 · T2.2, T2.3)', async () => {
        await mostra(<Cornice dati={letti(alSecondo(5), 5)} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['5', 'Marketing']);

        // Letti prima e arrivati dopo: una pagina ripresa dalla cronologia, una risposta in ritardo.
        await mostra(<Cornice dati={letti(alSecondo(3), 3, { workspace: { nome: 'Marketing di prima', slug: 'acme-marketing' } })} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['5', 'Marketing']);

        await mostra(<Cornice dati={letti(alSecondo(7), 2, { workspace: { nome: 'Marketing Europa', slug: 'acme-marketing' } })} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['2', 'Marketing Europa']);

        // Più indietro degli ultimi, anche se più avanti dei primi: i più recenti sono quelli della visita di prima.
        await mostra(<Cornice dati={letti(alSecondo(6), 9)} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['2', 'Marketing Europa']);
    });

    it.each([
        ['senza i decimali', '2026-10-06T12:00:03Z'],
        ['coi millisecondi', '2026-10-06T12:00:03.123Z'],
        ['senza la Z', '2026-10-06T12:00:03.123456'],
        ['con un altro fuso', '2026-10-06T10:00:03.123456-02:00'],
        ['che non è un testo', 20261006120003],
    ])('un segno in un\'altra forma (%s) vale «senza segno»: quei dati valgono come nella v1.2.1, anche se l\'istante è più indietro di quello dei dati di prima (sprint 11 · T2.6)', async (_forma, altraForma) => {
        await mostra(<Cornice dati={letti(alSecondo(5), 5)} onLogout={esciSenzaEffetto} />);
        await mostra(<Cornice dati={letti(altraForma as string, 2)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('2');
    });

    it.each([
        ['senza i decimali', '2026-10-06T12:00:09Z'],
        ['coi millisecondi', '2026-10-06T12:00:09.123Z'],
        ['senza la Z', '2026-10-06T12:00:09.123456'],
        ['con un altro fuso', '2026-10-06T14:00:09.123456+02:00'],
        ['che non è un testo', 20261006120009],
    ])('l\'istante di una rotta in un\'altra forma (%s) vale «senza istante», e non è un errore: l\'elenco e la lettura contano per i dati con cui sono stati chiesti, come nella v1.2.1 (sprint 11 · T2.6)', async (_forma, altraForma) => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: altraForma as string, segnateIl: altraForma as string }));
        await mostra(<Cornice dati={letti(alSecondo(1), 0)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(voci()).toHaveLength(3);
        expect(campanella()).toBe('2');
        // Dati letti prima di quell'istante: senza un istante da confrontare sono altri dati, e l'elenco non conta sul loro
        // numero. Con zero non lette si vede: se l'istante contasse com'è, sulla campanella resterebbero le 2 dell'elenco.
        await mostra(<Cornice dati={letti(alSecondo(3), 0)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={letti(alSecondo(4), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');

        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={letti(alSecondo(5), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');
    });

    it('dati con lo stesso segno di quelli che la cornice ha valgono come li dà la pagina: un frontend che li ritocca nel browser lasciando il segno vede il numero e il nome nuovi, come nella v1.2.1 (sprint 11 · T2.6)', async () => {
        const primi = letti(alSecondo(5), 5);
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['5', 'Marketing']);

        // Una notifica letta dalla pagina, il nome cambiato in un modulo: gli stessi dati con un altro contenuto.
        await mostra(<Cornice dati={{ ...primi, non_lette: 4, workspace: { nome: 'Marketing Europa', slug: 'acme-marketing' } }} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['4', 'Marketing Europa']);
    });

    it('dopo «Segna tutte come lette» una copia degli stessi dati, con lo stesso segno (Avanti del browser), non rimette il numero: la lettura è stata segnata dopo quel segno (sprint 11 · T2.1)', async () => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(2), segnateIl: alSecondo(3) }));
        const primi = letti(alSecondo(1), 12);
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();

        await mostra(<Cornice dati={structuredClone(primi)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
    });

    it.each([
        ['più indietro dei dati di prima', 1],
        ['fra i dati di prima e l\'elenco', 3],
    ])('ciò che la cornice sa è di un workspace: i dati di un altro, con un segno %s, valgono, e l\'elenco del workspace di prima non conta sul loro numero (sprint 11 · T2.6)', async (_quando, secondi) => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(4) }));
        await mostra(<Cornice dati={letti(alSecondo(2), 2)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');

        await mostra(<Cornice dati={letti(alSecondo(secondi), 0, vendite)} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual([null, 'Vendite']);
    });

    it.each([
        ['più indietro dei dati di prima', 1],
        ['fra l\'elenco e la lettura', 5],
    ])('ciò che la cornice sa è di un workspace: dopo «Segna tutte come lette» i dati di un altro, con un segno %s, mostrano il loro numero (sprint 11 · T2.6)', async (_quando, secondi) => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(4), segnateIl: alSecondo(6) }));
        await mostra(<Cornice dati={letti(alSecondo(2), 12)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();

        await mostra(<Cornice dati={letti(alSecondo(secondi), 5, vendite)} onLogout={esciSenzaEffetto} />);
        expect([campanella(), nomeDelWorkspace()]).toStrictEqual(['5', 'Vendite']);
    });

    it('dopo «Segna tutte come lette» i dati letti fino all\'istante della lettura non rimettono il numero, anche se arrivano dopo e anche se sono altri dati; quelli letti dopo mostrano il loro, anche se è lo stesso (sprint 11 · T2.3, T2.4)', async () => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(2), segnateIl: alSecondo(5) }));
        await mostra(<Cornice dati={letti(alSecondo(1), 12)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();

        // Una visita partita prima del clic, o una pagina che il prefetch teneva: letta prima della lettura.
        await mostra(<Cornice dati={letti(alSecondo(3), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        // Nello stesso istante della lettura: non dopo.
        await mostra(<Cornice dati={letti(alSecondo(5), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={letti(alSecondo(6), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');
    });

    it('le non lette dell\'elenco contano sulla campanella finché i dati sono letti fino all\'istante dell\'elenco, anche se arrivano dopo; coi dati letti dopo vale il loro numero (sprint 11 · T2.5)', async () => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(4) }));
        await mostra(<Cornice dati={letti(alSecondo(1), 0)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');

        // Una visita letta prima che il pannello caricasse l'elenco, arrivata dopo.
        await mostra(<Cornice dati={letti(alSecondo(3), 0)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('2');
        // Nello stesso istante dell'elenco: non dopo.
        await mostra(<Cornice dati={letti(alSecondo(4), 1)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('2');
        await mostra(<Cornice dati={letti(alSecondo(6), 0)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
    });

    it('se le rotte non danno l\'istante, coi dati col segno l\'elenco e la lettura contano per i dati con cui sono stati chiesti, come nella v1.2.1: altri dati, letti dopo, mostrano il loro numero (sprint 11 · T2.6)', async () => {
        vi.stubGlobal('fetch', rotte(notificheDelServer));
        const primi = letti(alSecondo(1), 0);
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('2');
        await mostra(<Cornice dati={letti(alSecondo(3), 0)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();

        const secondi = letti(alSecondo(5), 12);
        await mostra(<Cornice dati={secondi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={secondi} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={letti(alSecondo(7), 12)} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('12');
    });

    it('coi dati senza segno e le rotte che danno l\'istante vale ancora l\'oggetto dei dati, come nella v1.2.1: un dato senza segno non è né più vecchio né più recente di un istante (sprint 11 · T2.6)', async () => {
        vi.stubGlobal('fetch', rotteConGliIstanti(notificheDelServer, { lettoIl: alSecondo(4), segnateIl: alSecondo(6) }));
        const primi = letti(undefined, 0);
        await mostra(<Cornice dati={primi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');
        await mostra(<Cornice dati={{ ...primi }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();

        const secondi = letti(undefined, 12);
        await mostra(<Cornice dati={secondi} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={secondi} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        await mostra(<Cornice dati={{ ...secondi }} onLogout={esciSenzaEffetto} />);
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

    /**
     * I titoli dei 19 tipi di evento del contratto, in italiano, inglese e spagnolo: la tabella dello sprint 12, scritta qui e
     * non letta dai file delle lingue.
     */
    const titoliPerTipo: [tipo: string, it: string, en: string, es: string][] = [
        ['com.zeiras.app.modificata', "Un'app del workspace è stata attivata o disattivata", 'An app in the workspace was turned on or off', 'Se activó o desactivó una app del workspace'],
        ['com.zeiras.workspace.creato', 'Il workspace è stato creato', 'The workspace was created', 'Se creó el workspace'],
        ['com.zeiras.workspace.modificato', 'Il workspace è stato modificato', 'The workspace was changed', 'Se modificó el workspace'],
        ['com.zeiras.workspace.membro.creato', 'Una persona è entrata nel workspace', 'Someone joined the workspace', 'Una persona entró en el workspace'],
        ['com.zeiras.workspace.membro.modificato', 'Il ruolo di un membro è cambiato', "A member's role changed", 'Cambió el rol de un miembro'],
        ['com.zeiras.workspace.membro.eliminato', 'Una persona è uscita dal workspace', 'Someone left the workspace', 'Una persona salió del workspace'],
        ['com.zeiras.board.cartella.creata', 'Nuova cartella', 'New folder', 'Nueva carpeta'],
        ['com.zeiras.board.cartella.modificata', 'Cartella modificata', 'Folder changed', 'Carpeta modificada'],
        ['com.zeiras.board.cartella.eliminata', 'Cartella eliminata', 'Folder deleted', 'Carpeta eliminada'],
        ['com.zeiras.board.board.creata', 'Nuova board', 'New board', 'Nuevo tablero'],
        ['com.zeiras.board.board.modificata', 'Board modificata', 'Board changed', 'Tablero modificado'],
        ['com.zeiras.board.lista.creata', 'Nuova lista', 'New list', 'Nueva lista'],
        ['com.zeiras.board.lista.modificata', 'Lista modificata', 'List changed', 'Lista modificada'],
        ['com.zeiras.board.scheda.creata', 'Nuova scheda', 'New card', 'Nueva tarjeta'],
        ['com.zeiras.board.scheda.modificata', 'Scheda modificata', 'Card changed', 'Tarjeta modificada'],
        ['com.zeiras.board.scheda.eliminata', 'Scheda eliminata', 'Card deleted', 'Tarjeta eliminada'],
        ['com.zeiras.board.etichetta.creata', 'Nuova etichetta', 'New label', 'Nueva etiqueta'],
        ['com.zeiras.board.etichetta.modificata', 'Etichetta modificata', 'Label changed', 'Etiqueta modificada'],
        ['com.zeiras.board.etichetta.eliminata', 'Etichetta eliminata', 'Label deleted', 'Etiqueta eliminada'],
    ];
    /** Il titolo di ripiego, per lingua. */
    const diRipiego: Record<string, string> = { it: 'Novità nel workspace', en: 'News in the workspace', es: 'Novedades en el workspace' };
    const titoli = () => voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent);

    it('la tabella dei titoli ha 19 tipi, tutti diversi (sprint 12 · T3.1)', () => {
        expect(new Set(titoliPerTipo.map(([tipo]) => tipo)).size).toBe(19);
        expect(titoliPerTipo).toHaveLength(19);
    });

    it.each(titoliPerTipo.flatMap(([tipo, it, en, es]) => [[tipo, 'it', it], [tipo, 'en', en], [tipo, 'es', es]]))(
        'una notifica di tipo %s, con la lingua "%s", nel pannello si chiama «%s» (sprint 12 · T3.1)',
        async (tipo, lingua, titolo) => {
            // Con un prodotto e senza: il titolo viene dal tipo, non da `app`.
            const elenco = [{ ...nata('uat-n51', '2026-10-06T11:55:00Z'), tipo, app: 'crm' }, { ...nata('uat-n50', '2026-10-06T11:50:00Z'), tipo }];
            vi.stubGlobal('fetch', rotte(elenco));
            await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 2 }} onLogout={esciSenzaEffetto} />);

            await clic(uno('.zr-bell'));
            expect(titoli()).toStrictEqual([titolo, titolo]);
        },
    );

    it.each(['it', 'en', 'es'])('con la lingua "%s", una notifica di un tipo che zr-core non conosce, o senza tipo, ha il titolo di ripiego: mai il codice del tipo, mai un titolo vuoto (sprint 12 · T3.2)', async (lingua) => {
        const tipi: unknown[] = [
            // Un tipo che il contratto non ha ancora, e uno che ha solo il nome di un altro davanti o dietro.
            'com.zeiras.crm.contatto.creato', 'com.zeiras.board.scheda', 'com.zeiras.board.scheda.creata.poi', 'COM.ZEIRAS.BOARD.SCHEDA.CREATA', ' com.zeiras.board.scheda.creata',
            // Nomi che ogni oggetto ha, e il vuoto.
            'constructor', '__proto__', 'toString', '',
            // Ciò che non è un testo: anche un elenco che, scritto come testo, sarebbe un tipo conosciuto.
            null, 7, true, ['com.zeiras.board.scheda.creata'], { toString: () => 'com.zeiras.board.scheda.creata' },
        ];
        // In più una senza `tipo`, e in fondo una di un tipo conosciuto: il pannello non si è fermato prima.
        const elenco = [
            ...tipi.map((tipo, indice) => ({ ...nata(`uat-n${90 - indice}`, '2026-10-06T11:55:00Z'), tipo })),
            nata('uat-n61', '2026-10-06T11:50:00Z'),
            { ...nata('uat-n60', '2026-10-06T11:45:00Z'), tipo: 'com.zeiras.board.scheda.creata' },
        ];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 3 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        const delTipo = titoliPerTipo.find(([tipo]) => tipo === 'com.zeiras.board.scheda.creata')!;
        expect(titoli()).toStrictEqual([...tipi.map(() => diRipiego[lingua]), diRipiego[lingua], delTipo[['', 'it', 'en', 'es'].indexOf(lingua)]]);
        // Nel pannello non si legge il codice di un tipo.
        expect(uno('.zr-notif')?.textContent).not.toMatch(/com\.zeiras|constructor|__proto__/i);
    });

    // Sprint 16 · T5 (voce #1479): fuori dalla cornice il titolo di un tipo lo dà `titoloDellaNotifica`, dall'ingresso del
    // pacchetto, ed è la funzione del pannello: tipo per tipo, i due testi sono uno solo.
    it.each(['it', 'es', 'en', 'pt-BR'])('con la lingua "%s", titoloDellaNotifica dà a ogni tipo lo stesso titolo che il pannello mostra a una notifica di quel tipo: quello dei 19 che zr-core conosce, e quello di ripiego agli altri (sprint 16 · T5.1)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        // I 19 tipi della tabella, poi ciò che zr-core non conosce: un tipo nuovo, un nome che ogni oggetto ha, il vuoto, ciò che
        // non è un testo; in fondo all'elenco, una notifica senza `tipo`.
        const tipi: unknown[] = [...titoliPerTipo.map(([tipo]) => tipo), 'com.zeiras.crm.contatto.creato', 'constructor', '', null, 7, ['com.zeiras.board.scheda.creata']];
        const elenco = [...tipi.map((tipo, indice) => ({ ...nata(`uat-n${90 - indice}`, '2026-10-06T11:55:00Z'), tipo })), nata('uat-n50', '2026-10-06T11:50:00Z')];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 3 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        const dellaFunzione = [...tipi.map((tipo) => titoloDellaNotifica(tipo, lingua)), titoloDellaNotifica(undefined, lingua)];
        expect(titoli()).toStrictEqual(dellaFunzione);
        // Non sono due elenchi di ripieghi: i primi 19 sono i titoli della tabella nella lingua (in inglese, se zr-core non la
        // ha), e gli altri sette il ripiego.
        const deiTesti = lingua in diRipiego ? lingua : 'en';
        expect(dellaFunzione.slice(0, 19)).toStrictEqual(titoliPerTipo.map((riga) => riga[['', 'it', 'en', 'es'].indexOf(deiTesti)]));
        expect(dellaFunzione.slice(19)).toStrictEqual(Array.from({ length: 7 }, () => diRipiego[deiTesti]));
    });

    it.each<[lingua: string, nonLetteNeiDati: number | undefined, nonLetteCaricate: number, nome: string]>([
        ['it', 0, 0, 'Notifiche'],
        ['it', 1, 0, 'Notifiche, 1 non letta'],
        ['it', 2, 0, 'Notifiche, 2 non lette'],
        ['it', 100, 0, 'Notifiche, 99+ non lette'],
        ['en', 0, 0, 'Notifications'],
        ['en', 1, 0, 'Notifications, 1 unread'],
        ['en', 2, 0, 'Notifications, 2 unread'],
        ['es', 0, 0, 'Notificaciones'],
        ['es', 1, 0, 'Notificaciones, 1 sin leer'],
        ['es', 2, 0, 'Notificaciones, 2 sin leer'],
        // Senza numero nei dati contano le non lette caricate: le conta il design system, e il nome le segue.
        ['it', undefined, 1, 'Notifiche, 1 non letta'],
        ['it', undefined, 2, 'Notifiche, 2 non lette'],
        ['en', undefined, 1, 'Notifications, 1 unread'],
        ['es', undefined, 1, 'Notificaciones, 1 sin leer'],
        // Il numero dei dati e un elenco più recente con più non lette: vale il numero che la campanella mostra.
        ['it', 1, 2, 'Notifiche, 2 non lette'],
    ])('con la lingua "%s", %s non lette nei dati e %s caricate, la campanella per il lettore di schermo si chiama «%s» (sprint 12 · T3.4)', async (lingua, nonLetteNeiDati, nonLetteCaricate, nome) => {
        const elenco = [
            ...Array.from({ length: nonLetteCaricate }, (_, indice) => nata(`uat-n${80 - indice}`, '2026-10-06T11:55:00Z')),
            nata('uat-n70', '2026-10-06T11:00:00Z', true),
        ];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: nonLetteNeiDati }} onLogout={esciSenzaEffetto} />);
        if (nonLetteCaricate > 0) {
            await clic(uno('.zr-bell'));
            expect(nonLette()).toStrictEqual([...Array.from({ length: nonLetteCaricate }, () => true), false]);
        }

        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe(nome);
    });

    it('dopo «Segna tutte come lette» su una sola non letta la campanella torna a chiamarsi «Notifiche» (sprint 12 · T3.4)', async () => {
        vi.stubGlobal('fetch', rotte([nata('uat-n80', '2026-10-06T11:55:00Z')]));
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe('Notifiche, 1 non letta');

        await clic(segnaTutte());
        expect(campanella()).toBeNull();
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe('Notifiche');
    });

    // Sprint 12 · T4 (voce #1461). Oltre le 25.000 non lette, o se i richiami al backoffice durano troppo, la parte server si ferma
    // a un tetto e dice che ne restano (`altre: true`). La cornice non fa finta che siano tutte lette: tiene il numero, non dà
    // per lette le notifiche in pagina, ricarica il pannello, e «Segna tutte come lette» resta per continuare. Con `altre: false`,
    // o senza `altre` (una parte server di prima della `v1.3.0`), fa ciò che fa la `v1.2.2`.

    /**
     * Le due rotte che rispondono subito: a ogni caricamento l'elenco dopo (finiti, l'ultimo), e a ogni «Segna tutte come lette»
     * l'`altre` dopo (finiti, l'ultimo; `undefined`: la risposta non lo porta). Con gli istanti, o senza come nella `v1.2.1`.
     */
    const rotteConAltre = (elenchi: unknown[][], altre: unknown[], { lettoIl, segnateIl }: { lettoIl?: string; segnateIl?: string } = {}) => {
        let caricamenti = 0;
        let letture = 0;

        return vi.fn(async (indirizzo: string, opzioni?: RequestInit) => {
            if (indirizzo === '/cornice/notifiche') {
                return risposta({ data: elenchi[Math.min(caricamenti++, elenchi.length - 1)], ...(lettoIl === undefined ? {} : { aggiornati_il: lettoIl }) });
            }
            const dice = altre[Math.min(letture++, altre.length - 1)];

            return risposta({
                data: { fino_a: new Date(String(corpoDi(opzioni).fino_a)).toISOString(), ...(dice === undefined ? {} : { altre: dice }) },
                ...(segnateIl === undefined ? {} : { segnate_il: segnateIl }),
            });
        });
    };
    /** Le caricate dopo una lettura fermata da un tetto: il backoffice ne ha segnate una parte, e la più recente resta da leggere. */
    const dopoUnaParte = [notificheDelServer[0], { ...notificheDelServer[1], letta: true }, notificheDelServer[2]];

    // Il numero dei dati è piccolo per vedere che resta proprio quello, e non le non lette del pannello ricaricato: nel browser
    // i tetti della parte server non contano.
    it.each<[string, DatiDellaCornice, { lettoIl?: string; segnateIl?: string }]>([
        ['con gli istanti della parte server', letti(alSecondo(5), 60), { lettoIl: alSecondo(6), segnateIl: alSecondo(9) }],
        ['senza istanti, come nella v1.2.1', { ...dati, non_lette: 60 }, {}],
    ])('se la parte server dice che ne restano (altre: true) la campanella tiene il numero dei dati, le notifiche in pagina non si danno per lette, il pannello si ricarica e «Segna tutte come lette» resta; al clic dopo, con altre: false, fa ciò che fa la v1.2.2: %s (sprint 12 · T4.5)', async (_caso, deiDati, istanti) => {
        const fetchFinto = rotteConAltre([notificheDelServer, dopoUnaParte], [true, false], istanti);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={deiDati} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('60');
        expect(nonLette()).toStrictEqual([true, true, false]);

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(campanella()).toBe('60');
        // In pagina c'è l'elenco ricaricato, com'è davvero: non le caricate di prima date per lette.
        expect(nonLette()).toStrictEqual([true, false, false]);
        expect(segnaTutte()).not.toBeNull();

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[3][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(segnaTutte()).toBeNull();
    });

    it('senza il numero nei dati, con altre: true il pannello si ricarica e la campanella conta ciò che resta da leggere fra le ricaricate: non resta senza numero, e «Segna tutte come lette» resta (sprint 12 · T4.5)', async () => {
        const fetchFinto = rotteConAltre([notificheDelServer, dopoUnaParte], [true]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(campanella()).toBe('1');
        expect(nonLette()).toStrictEqual([true, false, false]);
        expect(segnaTutte()).not.toBeNull();
    });

    // Solo il booleano `true` vuol dire che ne restano: la parte server di zr-core dà sempre un booleano, e una di prima non dà niente.
    it.each<[string, unknown]>([
        ['altre: false', false],
        ['nessun altre, come da una parte server di prima della v1.3.0', undefined],
        ['altre: "true", che non è un booleano', 'true'],
        ['altre: 1, che non è un booleano', 1],
    ])('con %s «Segna tutte come lette» fa ciò che fa la v1.2.2: le caricate sono lette, la campanella non ha più un numero, il pannello non si ricarica e il pulsante non c\'è più (sprint 12 · T4.5)', async (_caso, altre) => {
        const fetchFinto = rotteConAltre([notificheDelServer, dopoUnaParte], [altre]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('60');

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(segnaTutte()).toBeNull();
    });

    // Sprint 12 · review della PR, R2. Con `altre: true` il pannello si ricarica senza passare dal caricamento: l'elenco di prima
    // resta in pagina e «Segna tutte come lette» resta dov'è, col fuoco, per il clic dopo. Se si svuotasse, il pulsante sparirebbe
    // mentre ha il fuoco, e da tastiera il clic dopo vorrebbe di nuovo il giro di Tab.

    /**
     * Le due rotte, con gli elenchi e le letture che il test decide: a ogni caricamento l'elenco dopo, che può essere una risposta
     * in attesa; a ogni «Segna tutte come lette» l'`altre` dopo.
     */
    const rotteUnaDopoLAltra = (elenchi: (unknown[] | Promise<Response>)[], altre: boolean[]) => {
        let caricamenti = 0;
        let letture = 0;

        return vi.fn(async (indirizzo: string, opzioni?: RequestInit) => {
            if (indirizzo === '/cornice/notifiche') {
                const elenco = elenchi[caricamenti++];

                return Array.isArray(elenco) ? risposta({ data: elenco }) : elenco;
            }

            return risposta({ data: { fino_a: new Date(String(corpoDi(opzioni).fino_a)).toISOString(), altre: altre[letture++] } });
        });
    };

    it('con altre: true, mentre l\'elenco nuovo non è arrivato, il pannello non è in caricamento: l\'elenco di prima resta in pagina e «Segna tutte come lette» resta dov\'è, col fuoco; e resta quando l\'elenco arriva (sprint 12 · review, R2)', async () => {
        const ricaricato = inAttesa();
        const fetchFinto = rotteUnaDopoLAltra([notificheDelServer, ricaricato.promessa], [true]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();
        pulsante?.focus();
        expect(document.activeElement).toBe(pulsante);

        await clic(pulsante);
        // La lettura ha risposto che ne restano, e l'elenco nuovo è stato chiesto ma non è arrivato.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(uno('.zr-notif [role="status"]')).toBeNull();
        expect(nonLette()).toStrictEqual([true, true, false]);
        expect(campanella()).toBe('60');
        // Lo stesso pulsante di prima, non uno nuovo: è ancora quello che ha il fuoco.
        expect(segnaTutte()).toBe(pulsante);
        expect(document.activeElement).toBe(pulsante);

        await ricaricato.arriva(risposta({ data: dopoUnaParte }));
        expect(nonLette()).toStrictEqual([true, false, false]);
        expect(campanella()).toBe('60');
        expect(segnaTutte()).toBe(pulsante);
        expect(document.activeElement).toBe(pulsante);
    });

    it('un clic mentre il pannello si ricarica dopo altre: true continua la lettura dallo stesso istante; se finisce prima che quell\'elenco arrivi, l\'elenco — letto prima della lettura — non conta, e il pannello si ricarica (sprint 12 · review, R2)', async () => {
        const lettoPrima = inAttesa();
        const fetchFinto = rotteUnaDopoLAltra([notificheDelServer, lettoPrima.promessa, tutteLette], [true, false]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);

        // Il secondo clic, con l'elenco nuovo ancora in volo: la lettura riparte dall'istante dell'elenco in pagina.
        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual([
            'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche',
        ]);
        expect(corpoDi(fetchFinto.mock.calls[3][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(campanella()).toBeNull();
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(segnaTutte()).toBeNull();

        // L'elenco chiesto dopo il primo clic arriva adesso, con le non lette di allora: non torna in pagina né sulla campanella.
        await lettoPrima.arriva(risposta({ data: notificheDelServer }));
        expect(nonLette()).toStrictEqual([false, false, false]);
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();
    });

    it('se dopo altre: true il ricaricamento fallisce, il pannello mostra l\'errore e «Riprova», come ogni caricamento fallito, e la campanella tiene il numero (sprint 12 · review, R2)', async () => {
        const fetchFinto = rotteUnaDopoLAltra([notificheDelServer, Promise.resolve(risposta({}, 500)), dopoUnaParte], [true]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(uno('.zr-notif [role="alert"]')).not.toBeNull();
        expect(voci()).toHaveLength(0);
        expect(campanella()).toBe('60');

        await clic(uno('.zr-notif [role="alert"] button'));
        expect(uno('.zr-notif [role="alert"]')).toBeNull();
        expect(nonLette()).toStrictEqual([true, false, false]);
        expect(segnaTutte()).not.toBeNull();
    });

    // Sprint 12 · seconda lettura della PR, N1. L'elenco ricaricato dopo `altre: true` arriva, e prima che la pagina sia ridisegnata
    // il pulsante in pagina è ancora quello dell'elenco di prima: un clic lì manda l'istante di prima. Se quella lettura finisce
    // (`altre: false`), le notifiche dell'elenco nuovo nate dopo quell'istante non sono state segnate: la cornice non le dà per
    // lette, ricarica il pannello.
    it('un clic fra l\'arrivo dell\'elenco ricaricato e il ridisegno manda l\'istante dell\'elenco di prima: una notifica dell\'elenco nuovo nata dopo non si dà per letta, e il pannello si ricarica (sprint 12 · seconda lettura, N1)', async () => {
        let arriva!: (valore: Response) => void;
        const ricaricato = new Promise<Response>((risolvi) => (arriva = risolvi));
        const conLaNuova = [nata('uat-n42', '2026-10-06T11:58:00+00:00'), ...tutteLette];
        const fetchFinto = rotteUnaDopoLAltra([notificheDelServer, ricaricato, conLaNuova], [true, false]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        const pulsante = segnaTutte();

        // Nello stesso `act` niente si ridisegna: l'elenco nuovo arriva, e il clic cade sulla pagina di prima.
        await act(async () => {
            arriva(risposta({ data: conLaNuova }));
            await prossimoGiro();
            expect(voci()).toHaveLength(3);
            pulsante?.click();
            await prossimoGiro();
        });

        // Il clic ha mandato l'istante dell'elenco di prima, non quello della notifica nata dopo; e il pannello si è ricaricato.
        expect(richieste(fetchFinto)).toStrictEqual([
            'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche',
        ]);
        expect(corpoDi(fetchFinto.mock.calls[3][1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        // La notifica nata dopo quell'istante non è stata segnata: resta non letta in pagina e sulla campanella.
        expect(nonLette()).toStrictEqual([true, false, false, false]);
        expect(campanella()).toBe('1');
        expect(segnaTutte()).not.toBeNull();
    });

    // Sprint 12 · review della PR, R3. Il design system ha un testo solo per le non lette: è nel nome della campanella ed è il nome
    // del pallino di ogni notifica non letta. Col singolare di zr-core il pallino segue il numero della campanella, non la notifica.
    it.each<[lingua: string, nonLetteNeiDati: number, nonLetteCaricate: number, pallino: string]>([
        ['it', 1, 1, 'non letta'],
        ['it', 3, 3, 'non lette'],
        // Una sola non letta in pagina e tre sulla campanella: le altre due stanno oltre la prima pagina.
        ['it', 3, 1, 'non lette'],
        // Il numero che la campanella mostra, non quello dei dati: un elenco più recente ne ha due.
        ['it', 1, 2, 'non lette'],
        ['en', 1, 1, 'unread'],
        ['es', 3, 3, 'sin leer'],
    ])('con la lingua "%s", %s non lette nei dati e %s caricate, il pallino di ogni notifica non letta si chiama «%s» per il lettore di schermo, come le non lette della campanella (sprint 12 · review, R3)', async (lingua, nonLetteNeiDati, nonLetteCaricate, pallino) => {
        const elenco = [
            ...Array.from({ length: nonLetteCaricate }, (_, indice) => nata(`uat-n${80 - indice}`, '2026-10-06T11:55:00Z')),
            nata('uat-n70', '2026-10-06T11:00:00Z', true),
        ];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: nonLetteNeiDati }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        expect(voci().map((voce) => voce.querySelector('.zr-notif-dot')?.getAttribute('aria-label') ?? null))
            .toStrictEqual([...Array.from({ length: nonLetteCaricate }, () => pallino), null]);
    });

    // Sprint 17 · T1 (voce #1481). Il pulsante dice che cosa sta succedendo: dal clic alla risposta che la richiesta è in corso
    // («Segno…»), e dopo `altre: true` che c'è da continuare («Segna le altre»), finché quel giro di letture non è finito. I due
    // testi sono di zr-core (`markingAllRead`, `markRestRead`): `markAllRead` resta quello del design system. Il pulsante è sempre
    // lo stesso elemento, e cambia solo il testo.

    /**
     * Le due rotte, con le letture che il test decide: a ogni caricamento l'elenco dopo (finiti, l'ultimo), che può essere una
     * risposta in attesa; a ogni «Segna tutte come lette» la risposta dopo, pronta o in attesa.
     */
    const rotteConLetture = (elenchi: (unknown[] | Promise<Response>)[], letture: (Response | Promise<Response>)[]) => {
        let caricamenti = 0;
        let partite = 0;

        return vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => {
            if (indirizzo === '/cornice/notifiche') {
                const elenco = elenchi[Math.min(caricamenti++, elenchi.length - 1)];

                return Array.isArray(elenco) ? risposta({ data: elenco }) : elenco;
            }

            return letture[partite++];
        });
    };
    /** La risposta di una lettura riuscita: se ne restano (`altre`). */
    const letturaFatta = (altre: boolean) => risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z', altre } });
    /** I tre testi del pulsante in una lingua: fermo, con la richiesta in corso, con altre da segnare. */
    const testiDelPulsante: [lingua: string, fermo: string, inCorso: string, leAltre: string][] = [
        ['it', 'Segna tutte come lette', 'Segno…', 'Segna le altre'],
        ['es', 'Marcar todas como leídas', 'Marcando…', 'Marcar las demás'],
        ['en', 'Mark all as read', 'Marking…', 'Mark the rest'],
        // Una lingua che zr-core non ha: anche i due testi nuovi sono in inglese.
        ['de', 'Mark all as read', 'Marking…', 'Mark the rest'],
    ];
    const nomeDellaCampanella = () => uno('.zr-bell')?.getAttribute('aria-label');

    it.each(testiDelPulsante)('con la lingua "%s", dal clic alla risposta il pulsante dice che la richiesta è in corso, e un clic lì non ne fa partire un\'altra; alla risposta se ne va col numero della campanella (sprint 17 · T1.1, T1.4)', async (lingua, fermo, inCorso) => {
        const lettura = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer], [lettura.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();
        expect(pulsante?.textContent).toBe(fermo);

        await clic(pulsante);
        // La risposta non è arrivata e il testo è già cambiato, sullo stesso pulsante.
        expect(segnaTutte()).toBe(pulsante);
        expect(pulsante?.textContent).toBe(inCorso);
        await clic(pulsante);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(pulsante?.textContent).toBe(inCorso);

        await lettura.arriva(letturaFatta(false));
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();
    });

    it.each(testiDelPulsante)('con la lingua "%s", dopo altre: true il pulsante dice che ce ne sono altre da segnare, mentre il pannello si ricarica e quando l\'elenco nuovo è arrivato: è lo stesso pulsante, col fuoco (sprint 17 · T1.2)', async (lingua, _fermo, _inCorso, leAltre) => {
        const ricaricato = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer, ricaricato.promessa], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();
        pulsante?.focus();

        await clic(pulsante);
        // La lettura ha risposto che ne restano; l'elenco nuovo è stato chiesto e non è arrivato.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
        expect(segnaTutte()).toBe(pulsante);
        expect(pulsante?.textContent).toBe(leAltre);
        expect(document.activeElement).toBe(pulsante);

        await ricaricato.arriva(risposta({ data: dopoUnaParte }));
        expect(segnaTutte()).toBe(pulsante);
        expect(pulsante?.textContent).toBe(leAltre);
        expect(document.activeElement).toBe(pulsante);
    });

    it('«Segna le altre» vale finché quel giro di letture non è finito: dopo la lettura completa, una notifica arrivata dopo trova «Segna tutte come lette» (sprint 17 · T1.3)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], [letturaFatta(true), letturaFatta(false)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Il clic che continua finisce la lettura: il pulsante se ne va col numero.
        await clic(segnaTutte());
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();

        // Una visita dopo, a pannello aperto: i dati nuovi contano una notifica arrivata dopo la lettura. È un altro giro.
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('1');
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
    });

    // Review della PR #20, R3. Il giro di letture può finire altrove — un'altra scheda segna le rimaste —, a pannello aperto: i
    // dati della visita dopo non contano più non lette, e il pulsante se ne va. Una notifica arrivata dopo è un altro giro.
    it('se il giro di letture finisce altrove, a pannello aperto, una notifica arrivata dopo trova «Segna tutte come lette» e non «Segna le altre» (sprint 17 · review, R3)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Una visita dopo: le rimaste le ha segnate un'altra scheda, e i dati nuovi non contano più non lette.
        await mostra(<Cornice dati={{ ...dati, non_lette: 0 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();

        // Un'altra visita ancora: è arrivata una notifica nuova.
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('1');
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
        // Nessuna richiesta in più: il pannello non è stato ricaricato, e il testo non viene da un elenco chiesto da capo.
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
    });

    // Seconda lettura della PR #20, N4. A giro aperto dei dati nuovi non bastano a chiuderlo: una visita che conta ancora non
    // lette lascia «Segna le altre», e lo chiude solo quella che non ne conta più.
    it('a giro aperto una visita che conta ancora non lette lascia «Segna le altre»: lo chiude solo quella che non ne conta più (sprint 17 · review, N4)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Una visita dopo, a pannello aperto: un'altra scheda ne ha segnate una parte, e ne restano quaranta.
        await mostra(<Cornice dati={{ ...dati, non_lette: 40 }} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBe('40');
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Un'altra visita: le rimaste sono segnate. La notifica che arriva dopo è un altro giro.
        await mostra(<Cornice dati={{ ...dati, non_lette: 0 }} onLogout={esciSenzaEffetto} />);
        expect(segnaTutte()).toBeNull();
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
    });

    // Seconda lettura della PR #20, N5. Senza il numero nei dati la campanella conta le non lette in pagina, che vanno a zero anche
    // quando un elenco non arriva: una campanella a zero non dice che il giro è finito.
    it('senza il numero nei dati, un ricaricamento fallito a giro aperto non chiude il giro: la lettura in volo risponde altre: true e il pulsante dice «Segna le altre» (sprint 17 · review, N5)', async () => {
        const ricaricato = inAttesa();
        const seconda = inAttesa();
        const ricaricatoDiNuovo = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer, ricaricato.promessa, ricaricatoDiNuovo.promessa], [letturaFatta(true), seconda.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Il secondo clic, con l'elenco nuovo ancora in volo; poi quell'elenco non arriva, e il pannello mostra l'errore.
        await clic(segnaTutte());
        await ricaricato.arriva(risposta({}, 500));
        expect(uno('.zr-notif [role="alert"]')).not.toBeNull();
        expect(segnaTutte()).toBeNull();

        // La seconda lettura risponde che ne restano, e il pannello si ricarica: finché l'elenco non arriva resta l'errore.
        await seconda.arriva(letturaFatta(true));
        expect(richieste(fetchFinto)).toStrictEqual([
            'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche',
        ]);
        expect(uno('.zr-notif [role="alert"]')).not.toBeNull();

        // L'elenco arriva: il pulsante torna, e dice ciò che la parte server ha appena detto.
        await ricaricatoDiNuovo.arriva(risposta({ data: dopoUnaParte }));
        expect(uno('.zr-notif [role="alert"]')).toBeNull();
        expect(segnaTutte()?.textContent).toBe('Segna le altre');
    });

    // Che il giro è finito altrove lo dicono solo dei dati letti dopo la risposta che ha detto `altre`: quelli letti prima sono più
    // vecchi di lei, anche se contano zero. Qui i dati contano zero e l'elenco, letto dopo, ha le non lette arrivate nel frattempo:
    // è il caso di una notifica che arriva a pagina aperta, con una parte server lenta che si ferma al tetto dei secondi.
    it('dei dati che contano zero ma sono stati letti prima della risposta con altre: true non chiudono il giro: lo chiudono quelli letti dopo (sprint 17 · review, N5)', async () => {
        vi.stubGlobal('fetch', rotteConAltre([notificheDelServer, dopoUnaParte], [true], { lettoIl: alSecondo(3), segnateIl: alSecondo(5) }));
        await mostra(<Cornice dati={letti(alSecondo(1), 0)} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('2');
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // Una visita lenta: i suoi dati sono stati letti prima di quella risposta, e contano zero anche loro.
        await mostra(<Cornice dati={letti(alSecondo(2), 0)} onLogout={esciSenzaEffetto} />);
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        // I dati letti dopo quella risposta contano zero: il giro è finito altrove, e la notifica che arriva dopo è un altro giro.
        await mostra(<Cornice dati={letti(alSecondo(6), 0)} onLogout={esciSenzaEffetto} />);
        expect(segnaTutte()).toBeNull();
        await mostra(<Cornice dati={letti(alSecondo(7), 1)} onLogout={esciSenzaEffetto} />);
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
    });

    it('dopo altre: true, chiuso e riaperto il pannello il pulsante dice di nuovo «Segna tutte come lette»: l\'elenco è stato chiesto da capo (sprint 17 · T1.3)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(segnaTutte()?.textContent).toBe('Segna le altre');

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')).toBeNull();
        await clic(uno('.zr-bell'));
        expect(richieste(fetchFinto).slice(3)).toStrictEqual(['GET /cornice/notifiche']);
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
    });

    it('se dopo altre: true il ricaricamento fallisce, dopo «Riprova» il pulsante dice «Segna tutte come lette»: anche quello è un elenco chiesto da capo (sprint 17 · T1.3)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, Promise.resolve(risposta({}, 500)), dopoUnaParte], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());
        expect(uno('.zr-notif [role="alert"]')).not.toBeNull();

        await clic(uno('.zr-notif [role="alert"] button'));
        expect(nonLette()).toStrictEqual([true, false, false]);
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
    });

    it('il clic che continua dopo altre: true mostra di nuovo «Segno…», non «Segna le altre», e un clic lì non fa partire un\'altra richiesta; il nome della campanella resta al plurale (sprint 17 · T1.4)', async () => {
        const seconda = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], [letturaFatta(true), seconda.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();
        await clic(pulsante);
        expect(pulsante?.textContent).toBe('Segna le altre');

        await clic(pulsante);
        expect(segnaTutte()).toBe(pulsante);
        expect(pulsante?.textContent).toBe('Segno…');
        expect(nomeDellaCampanella()).toBe('Notifiche, 60 non lette');
        await clic(pulsante);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);

        await seconda.arriva(letturaFatta(false));
        expect(campanella()).toBeNull();
        expect(segnaTutte()).toBeNull();
    });

    // Il guardiano del doppio clic non è il testo: il secondo clic può cadere prima che la pagina sia ridisegnata.
    it('due clic nello stesso giro, prima che il pulsante dica «Segno…», fanno partire una richiesta sola (sprint 17 · T1.4)', async () => {
        const lettura = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer], [lettura.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();

        // Nello stesso `act` niente si ridisegna fra un clic e l'altro: il secondo cade sul pulsante di prima.
        await act(async () => {
            pulsante?.click();
            expect(pulsante?.textContent).toBe('Segna tutte come lette');
            pulsante?.click();
            await prossimoGiro();
        });
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(pulsante?.textContent).toBe('Segno…');
    });

    it.each<[string, boolean, string]>([
        ['«Segna tutte come lette»', false, 'Segna tutte come lette'],
        ['«Segna le altre», dopo altre: true', true, 'Segna le altre'],
    ])('se la richiesta fallisce il pulsante torna al testo che aveva prima del clic: %s (sprint 17 · T1.5)', async (_caso, dopoAltre, prima) => {
        const fallita = inAttesa();
        const fetchFinto = rotteConLetture([notificheDelServer, dopoUnaParte], dopoAltre ? [letturaFatta(true), fallita.promessa] : [fallita.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        const pulsante = segnaTutte();
        if (dopoAltre) {
            await clic(pulsante);
        }
        expect(pulsante?.textContent).toBe(prima);

        await clic(pulsante);
        expect(pulsante?.textContent).toBe('Segno…');

        await fallita.arriva(risposta({}, 500));
        expect(segnaTutte()).toBe(pulsante);
        expect(pulsante?.textContent).toBe(prima);
        expect(campanella()).toBe('60');
    });

    it.each<[string, boolean, string]>([
        ['mentre la richiesta è in corso', false, 'Segno…'],
        ['dopo altre: true', true, 'Segna le altre'],
    ])('con una sola non letta la campanella e il pallino restano al singolare e il pulsante ha il testo del suo momento, %s: i testi che zr-core dà al posto di quelli dell\'`AppShell` non si pestano (sprint 17 · T1.7)', async (_caso, risponde, testo) => {
        const lettura = inAttesa();
        const fetchFinto = rotteConLetture([[nata('uat-n80', '2026-10-06T11:55:00Z')]], [risponde ? letturaFatta(true) : lettura.promessa]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(nomeDellaCampanella()).toBe('Notifiche, 1 non letta');
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');

        await clic(segnaTutte());
        expect(nomeDellaCampanella()).toBe('Notifiche, 1 non letta');
        expect(uno('.zr-notif-dot')?.getAttribute('aria-label')).toBe('non letta');
        expect(segnaTutte()?.textContent).toBe(testo);
    });
});

// Sprint 3 · T5 (voce #1277). La ricerca Ctrl/Cmd+K attraverso POST /cornice/ricerca: una richiesta sola in volo, i risultati
// raggruppati per tipo dal registro, gli stati. Sprint 5 · T4 (voce #1257): un risultato è `{tipo, id, titolo}`, come in
// ricerca.elenca; di che prodotto è lo dice il registro, dal tipo. Sprint 18 · T1 (voce #1638): la parola cercata sta nel corpo
// della richiesta, mai nel suo indirizzo.
describe('la ricerca', () => {
    /**
     * I risultati come li dà POST /cornice/ricerca, nell'ordine del backoffice (per titolo): i tipi mescolati (l'`AppShell` apre
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
        cookieCsrf();
    });

    /** Il giro dopo, coi timer finti: le risposte già pronte arrivano. */
    const giro = () => vi.advanceTimersByTimeAsync(0);
    /** Le richieste partite, nell'ordine: il metodo, l'indirizzo e il corpo, così come sono. */
    const partite = (fetchFinto: { mock: { calls: [indirizzo: string, opzioni?: RequestInit][] } }) => fetchFinto.mock.calls.map(([indirizzo, opzioni]) => [opzioni?.method, indirizzo, opzioni?.body]);
    /** La richiesta della ricerca di quella parola, come deve partire: una POST all'indirizzo della rotta e basta, con la parola nel corpo. */
    const ricercaDi = (parola: string) => ['POST', '/cornice/ricerca', JSON.stringify({ q: parola })];
    /** La parola nel corpo di una richiesta partita; `undefined` se non ha un corpo. */
    const parolaDi = (opzioni?: RequestInit) => (typeof opzioni?.body === 'string' ? (JSON.parse(opzioni.body) as { q?: unknown }).q : undefined);

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
        const fetchFinto = vi.fn((_indirizzo: string, opzioni?: RequestInit) => (parolaDi(opzioni) === 'ua' ? ua.promessa : uat.promessa));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('ua');
        await scrivi('uat');
        expect(partite(fetchFinto)).toStrictEqual([ricercaDi('ua'), ricercaDi('uat')]);
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
        // Una cartella non ha una pagina sua in zr-board: si apre sulla pagina del workspace, dove stanno le cartelle, senza
        // altro dopo lo slug.
        ['Marketing', 'https://board.zeiras.com/w/acme-marketing'],
        // Con `app: 'crm'` l'indirizzo resta quello di Project Management, e l'id entra codificato.
        ['Report marketing', 'https://board.zeiras.com/w/acme-marketing/b/uat%2F13'],
    ])('scegliere «%s» apre l\'indirizzo del prodotto che ha quel tipo nel registro, nel workspace dei dati, seguito dal percorso del tipo, anche da un altro prodotto (sprint 5 · T4.3; sprint 6 · T5.1)', async (titolo, indirizzo) => {
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

    it('due cartelle si aprono sulla stessa pagina del workspace e restano due risultati (sprint 6 · T5.1)', async () => {
        const cartelle = [
            { tipo: 'board.cartelle', id: 'uat-c1', titolo: 'Clienti' },
            { tipo: 'board.cartelle', id: 'uat-c2', titolo: 'Marketing' },
        ];
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: cartelle })));
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await scrivi('uat');
        expect(titoli()).toStrictEqual(['Clienti', 'Marketing']);
        await act(async () => {
            righe()[1]?.click();
            await giro();
        });
        expect(naviga.mock.calls).toStrictEqual([['https://board.zeiras.com/w/acme-marketing']]);
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
        expect(partite(fetchFinto)).toStrictEqual([ricercaDi('caffè latte')]);
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
        expect(partite(fetchFinto)).toStrictEqual([ricercaDi(mandata)]);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
    });

    it.each<[string, string | undefined, string | null]>([
        ['col cookie del gettone CSRF la POST lo porta in X-XSRF-TOKEN', 'eyJpdiI6Ik1h%3D%3D', 'eyJpdiI6Ik1h=='],
        ['senza il cookie parte senza X-XSRF-TOKEN', undefined, null],
    ])('cercare manda una sola POST /cornice/ricerca, con la parola nel corpo JSON e mai nell\'indirizzo, qualunque parola sia; %s (sprint 18 · T1.1)', async (_caso, cookie, gettone) => {
        cookieCsrf(cookie);
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: [risultatiDelServer[0]] }));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        // Spazi, accenti, e i segni che in un indirizzo aprono la query, ne separano le parti o la chiudono.
        const parola = 'caffè & latte? #1 100%';
        await scrivi(parola);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        const [indirizzo, opzioni] = fetchFinto.mock.calls[0];
        // L'indirizzo è quello della rotta e basta: niente `?`, e della parola nemmeno un pezzo, nemmeno codificato.
        expect(indirizzo).toBe('/cornice/ricerca');
        expect(opzioni?.method).toBe('POST');
        expect(opzioni?.body).toBe(JSON.stringify({ q: parola }));
        expect(new Headers(opzioni?.headers).get('Content-Type')).toBe('application/json');
        expect(new Headers(opzioni?.headers).get('X-XSRF-TOKEN')).toBe(gettone);
        expect(titoli()).toStrictEqual(['Lancio Q4']);
    });

    it.each([
        ['it', 'Cerca'],
        ['es', 'Buscar'],
        ['en', 'Search'],
    ])('con la lingua "%s" il campo della ricerca si chiama «%s» per il lettore di schermo (sprint 18 · T1.8)', async (lingua, nome) => {
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);

        expect(uno('.zr-search input')?.getAttribute('aria-label')).toBe(nome);
    });
});

// Sprint 12 · T5 (voce #1464). `active={null}`: nessuna voce della barra è attiva. L'`AppShell` segna la voce che ha l'id
// attivo, e senza un id la Dashboard: con `null` la cornice gli dà un id che nessuna voce di quel render ha. Senza `null` la
// voce segnata è quella della `v1.2.2`.
describe('la voce attiva della barra', () => {
    /** Le voci di Project Management, sotto il suo pulsante. */
    const vociDiPm: GruppoDiVoci[] = [{ group: 'Lavoro', items: [{ id: 'board', label: 'Board', icon: 'board' }, { id: 'elenco', label: 'Elenco', icon: 'list' }] }];
    const nomeDi = (voce: HTMLElement) => voce.querySelector('.zr-nav-label')?.textContent;
    /** I nomi delle voci segnate nella barra: la classe e `aria-current` stanno sempre sulle stesse voci. */
    const segnate = () => {
        const conLaClasse = tutti('a.zr-nav-item.is-active').map(nomeDi);
        expect(tutti('a.zr-nav-item[aria-current]').map(nomeDi)).toStrictEqual(conLaClasse);

        return conLaClasse;
    };

    it('con active={null} nessuna voce della barra è segnata, in una pagina di app.zeiras.com: né la Dashboard né un prodotto del menu Prodotti (sprint 12 · T5.1)', async () => {
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} active={null} />);

        // Le voci del menu Prodotti e «Impostazioni», che l'`AppShell` mette da sé in fondo alla barra.
        expect(tutti('a.zr-nav-item').map(nomeDi)).toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti', 'Impostazioni']);
        expect(segnate()).toStrictEqual([]);
    });

    it('con active={null} nessuna voce della barra è segnata, dentro un prodotto con le sue voci (sprint 12 · T5.1)', async () => {
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} product="pm" nav={vociDiPm} active={null} />);

        expect(tutti('a.zr-nav-item').map(nomeDi)).toStrictEqual(['Board', 'Elenco', 'Impostazioni']);
        expect(segnate()).toStrictEqual([]);
    });

    it.each<[string, { active?: string }, { product?: string; nav?: GruppoDiVoci[] }, string[]]>([
        ['senza active, in una pagina di app.zeiras.com', {}, {}, ['Dashboard']],
        ['con active undefined', { active: undefined }, {}, ['Dashboard']],
        ['con active vuoto', { active: '' }, {}, ['Dashboard']],
        ['con active "home"', { active: 'home' }, {}, ['Dashboard']],
        ['con l\'id di un prodotto del menu', { active: 'crm' }, {}, ['CRM']],
        ['con un id che nessuna voce ha', { active: 'uat-nessuna' }, {}, []],
        ['senza active, dentro un prodotto', {}, { product: 'pm', nav: vociDiPm }, []],
        ['con active undefined, dentro un prodotto', { active: undefined }, { product: 'pm', nav: vociDiPm }, []],
        ['con l\'id di una voce del prodotto', { active: 'elenco' }, { product: 'pm', nav: vociDiPm }, ['Elenco']],
        ['con un id che nessuna voce ha, dentro un prodotto', { active: 'uat-nessuna' }, { product: 'pm', nav: vociDiPm }, []],
    ])('senza null la voce segnata è quella della v1.2.2: %s (sprint 12 · T5.2)', async (_caso, attiva, pagina, attese) => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} {...pagina} {...attiva} />);

        expect(segnate()).toStrictEqual(attese);
        // All'`AppShell` arriva ciò che ha dato il frontend, com'è.
        expect(appShell.mock.lastCall?.[0].active).toBe(attiva.active);
    });

    it('nessuna voce può avere l\'id con cui la cornice dice «nessuna»: data una voce proprio con quell\'id, non è segnata, e l\'id è un altro (sprint 12 · T5.4)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        const idDato = () => appShell.mock.lastCall?.[0].active;
        const voci = [...vociDiPm[0].items];
        const dati_: string[] = [];

        // Tre volte: si legge l'id che l'`AppShell` riceve con `null`, e al giro dopo una voce del prodotto ha proprio quello.
        for (let giro = 0; giro < 3; giro += 1) {
            await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} product="pm" nav={[{ group: 'Lavoro', items: voci }]} active={null} />);
            const id = idDato();

            expect(typeof id).toBe('string');
            expect(id).not.toBe('');
            expect(voci.map((voce) => voce.id)).not.toContain(id);
            expect(ordine).not.toContain(id);
            // Nella barra ci sono le voci del prodotto e «Impostazioni», dell'`AppShell`.
            expect(tutti('a.zr-nav-item')).toHaveLength(voci.length + 1);
            expect(segnate()).toStrictEqual([]);
            dati_.push(id as string);
            voci.push({ id: id as string, label: `UAT voce ${giro + 1}`, icon: 'star' });
        }
        expect(new Set(dati_).size).toBe(3);

        // Lo stesso in una pagina di app.zeiras.com, dove le voci sono quelle del registro e quelle date dal frontend.
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} nav={[{ group: 'Lavoro', items: voci }]} active={null} />);
        expect(voci.map((voce) => voce.id)).not.toContain(idDato());
        expect(ordine).not.toContain(idDato());
        expect(tutti('a.zr-nav-item')).toHaveLength(ordine.length + voci.length + 1);
        expect(segnate()).toStrictEqual([]);
    });

    it('il prodotto aperto non dipende da active: con product="pm" e active={null} il pulsante del prodotto e la lista che lo riapre sono come con una voce attiva (sprint 12 · T5.5)', async () => {
        const delProdotto = async (active: string | null) => {
            await mostra(<Cornice key={String(active)} dati={dati} onLogout={esciSenzaEffetto} product="pm" nav={vociDiPm} active={active} />);
            const pulsante = uno('.zr-product-switch');
            const visto = { nome: pulsante?.querySelector('.zr-product-name')?.textContent, inTopbar: uno('.zr-top-product')?.textContent, lista: [] as (string | null | undefined)[], aperto: [] as (string | null | undefined)[] };
            await clic(pulsante);
            visto.lista = tutti('.zr-product-menu a.zr-nav-item').map(nomeDi);
            visto.aperto = tutti('.zr-product-menu a.zr-nav-item[aria-current="true"]').map(nomeDi);

            return visto;
        };

        const conUnaVoce = await delProdotto('board');
        expect(conUnaVoce).toStrictEqual({
            nome: 'Project Management',
            inTopbar: 'Project Management',
            lista: ['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti'],
            aperto: ['Project Management'],
        });
        expect(await delProdotto(null)).toStrictEqual(conUnaVoce);
        // Con la lista aperta l'unica voce segnata è il prodotto aperto, nella lista: nessuna voce del prodotto.
        expect(tutti('a.zr-nav-item.is-active').map(nomeDi)).toStrictEqual(['Project Management']);
    });
});

// Sprint 19 · review della PR #23, R3: ciò che la cornice decide da sé — il selettore, il numero sulla campanella, «Segna
// tutte come lette», le voci del menu del profilo — non lo cambia una prop con lo stesso nome arrivata fuori dal tipo, con uno
// spread, nemmeno quando la cornice non ha niente da dare: come nella `v1.8.0`, dove la sua prop valeva `undefined` e copriva
// quella del frontend.
describe('una prop fuori da `CorniceProps` non prende il posto di ciò che decide la cornice', () => {
    it('con uno spread di props che `Cornice` non ha, quando la cornice non dà niente al loro posto all\'`AppShell` non arrivano (sprint 19 · review, R3)', async () => {
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        const fuoriDalTipo = {
            companies: [{ id: 'x', name: 'X', workspaces: [{ slug: 'x', name: 'X' }] }],
            unreadCount: 99,
            onMarkAllRead: () => {},
            accountItems: [{ label: 'Voce del frontend' }],
        };
        // Senza aziende, senza non lette, senza notifiche caricate, con `piano`: la cornice non dà nessuna delle quattro.
        await mostra(<Cornice {...(fuoriDalTipo as object)} dati={dati} onLogout={esciSenzaEffetto} piano />);

        const props = (appShell.mock.lastCall?.[0] ?? {}) as Record<string, unknown>;
        expect(Object.keys(fuoriDalTipo).map((nome) => [nome, props[nome]])).toStrictEqual(Object.keys(fuoriDalTipo).map((nome) => [nome, undefined]));
    });
});
