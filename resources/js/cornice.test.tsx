import { act, Fragment, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { IconName } from '../zeiras/index';
import { Cornice, type StatoDellaRicerca } from './cornice';
import { destinazioneDellaNotifica, tonoDelWorkspace, type DatiDellaCornice, type GruppoDiVoci } from './index';
import { testi, testiDellaRicerca } from './lingue';
import { Zeiras } from './zeiras';
import * as componenti from './zeiras/componenti';

// Sprint 1 · T6 (voce #1255), riscritto nello sprint 2 · T4 (voce #1256). La `Cornice` resa in un DOM finto coi dati della parte
// server (`Cornice::dati()`): il menu Moduli dal registro incrociato con lo stato dei prodotti nel workspace, il pulsante del
// prodotto aperto, i testi della lingua dei dati, persona e workspace dove li mette il design system, e dove portano account e
// notifiche (linea guida 15, passi 8 e 10).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'attivo', reports: 'attivo' },
};
/** Le fonti della ricerca coi dati qui sopra: dei moduli attivi, solo Project Management ha risorse nel registro. */
const fontiDeiDati = ['pm.board.scheda', 'pm.board.board', 'pm.board.cartelle'] as const;
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
        expect(gruppo?.querySelector('.zr-nav-title')?.textContent).toBe('Moduli');
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
        expect(pulsante?.querySelector('.zr-product-over')?.textContent).toBe('Moduli');
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
        ['es', ['Dashboard', 'Gestión de proyectos', 'CRM', 'Reservas', 'Informes', 'Automatismos', 'Contenidos'], 'Reservas', 'Módulos'],
        ['en', ['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content'], 'Bookings', 'Modules'],
        ['zz', ['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content'], 'Bookings', 'Modules'],
    ])('con la lingua "%s" nei dati la cornice è in quella lingua, o in inglese se zr-core non la ha, qualunque sia la lingua del browser (T4.2; sprint 21 · T1.1: il nome del menu, esteso e chiuso)', async (lingua, nomi, bookings, menu) => {
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('it-IT');
        vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['it-IT', 'it']);
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);
        expect(appShell.mock.lastCall?.[0].labels).toStrictEqual({ ...testi(lingua), ...testiDellaRicerca(lingua, fontiDeiDati) });
        expect([...(uno('.zr-nav .zr-nav-group')?.querySelectorAll('a.zr-nav-item .zr-nav-label') ?? [])].map((voce) => voce.textContent)).toStrictEqual(nomi);
        expect(uno('.zr-nav .zr-nav-group .zr-nav-title')?.textContent).toBe(menu);

        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} product="bookings" />);
        expect(uno('.zr-product-switch .zr-product-name')?.textContent).toBe(bookings);
        expect(uno('.zr-product-switch .zr-product-over')?.textContent).toBe(menu);
        expect(uno('.zr-top-product')?.textContent).toBe(bookings);
        await clic(uno('.zr-product-switch'));
        expect(tutti('.zr-product-menu a.zr-nav-item .zr-nav-label').map((voce) => voce.textContent)).toStrictEqual(nomi);
    });

    // Sprint 25 · T4 (voce #1639): il segnaposto del campo e l'invito che si legge prima di due caratteri dicono le fonti della
    // ricerca nel workspace, cioè i tipi di risorsa dei moduli attivi lì: il segnaposto ne nomina al più tre, l'invito tutte.
    // Un modulo solo disponibile, in arrivo o senza risorse nel registro non dà fonti, e senza fonti restano i due testi corti.
    it.each<[lingua: string, prodotti: DatiDellaCornice['prodotti'], segnaposto: string, invito: string]>([
        ['it', { pm: 'attivo', crm: 'disponibile', bookings: 'attivo' }, 'Cerca schede, board, cartelle…', 'Cerca schede, board e cartelle: scrivi almeno 2 caratteri.'],
        ['it', { pm: 'attivo', crm: 'attivo' }, 'Cerca schede, board, cartelle…', 'Cerca schede, board, cartelle, contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        ['it', { pm: 'in_arrivo', crm: 'attivo' }, 'Cerca contatti, aziende, opportunità…', 'Cerca contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        ['it', { pm: 'disponibile', crm: 'in_arrivo', bookings: 'attivo', reports: 'attivo' }, 'Cerca…', 'Scrivi almeno 2 caratteri.'],
        ['it', {}, 'Cerca…', 'Scrivi almeno 2 caratteri.'],
        ['es', { pm: 'attivo', crm: 'disponibile' }, 'Busca tarjetas, tableros, carpetas…', 'Busca tarjetas, tableros y carpetas: escribe al menos 2 caracteres.'],
        ['es', { pm: 'attivo', crm: 'attivo' }, 'Busca tarjetas, tableros, carpetas…', 'Busca tarjetas, tableros, carpetas, contactos, empresas y oportunidades: escribe al menos 2 caracteres.'],
        ['es', {}, 'Busca…', 'Escribe al menos 2 caracteres.'],
        ['en', { pm: 'attivo', crm: 'disponibile' }, 'Search cards, boards, folders…', 'Search cards, boards, and folders: type at least 2 characters.'],
        ['en', { pm: 'attivo', crm: 'attivo' }, 'Search cards, boards, folders…', 'Search cards, boards, folders, contacts, companies, and opportunities: type at least 2 characters.'],
        ['en', {}, 'Search…', 'Type at least 2 characters.'],
        // Una lingua che zr-core non ha: in inglese.
        ['zz', { pm: 'attivo', crm: 'disponibile' }, 'Search cards, boards, folders…', 'Search cards, boards, and folders: type at least 2 characters.'],
    ])('con la lingua "%s" e i moduli %j, il segnaposto del campo di ricerca e l\'invito prima di due caratteri nominano le fonti dei moduli attivi nel workspace, e solo quelle: mai il testo fisso di prima, né quello dell\'`AppShell` (sprint 25 · T4.3)', async (lingua, prodotti, segnaposto, invito) => {
        await mostra(<Cornice dati={{ ...dati, lingua, prodotti }} onLogout={esciSenzaEffetto} />);
        expect((uno('.zr-search input') as HTMLInputElement).placeholder).toBe(segnaposto);
        await act(async () => uno('.zr-search input')?.focus());

        expect(uno('.zr-search-note')?.textContent).toBe(invito);
    });

    // Sprint 26 · T5 (voce #1767; lettura della PR #56, R9). L'elenco delle fonti lo scrive `Intl.ListFormat`, e un browser può non
    // averlo anche quando ha il resto di `Intl`: lì la cornice si disegna lo stesso, e i due testi sono quelli senza fonti.
    it.each<[lingua: string, segnaposto: string, invito: string]>([
        ['it', 'Cerca…', 'Scrivi almeno 2 caratteri.'],
        ['es', 'Busca…', 'Escribe al menos 2 caracteres.'],
        ['en', 'Search…', 'Type at least 2 characters.'],
    ])('in un browser senza `Intl.ListFormat` la cornice si disegna, in "%s", coi moduli che danno fonti: il segnaposto del campo di ricerca e l\'invito prima di due caratteri sono i due testi senza fonti, e il resto della cornice c\'è (sprint 26 · T5.1)', async (lingua, segnaposto, invito) => {
        // Il resto di `Intl` c'è: manca solo l'elenco, come in un browser che non lo ha ancora.
        vi.stubGlobal('Intl', Object.create(Intl, { ListFormat: { value: undefined } }));
        expect(Intl.ListFormat).toBeUndefined();

        await mostra(<Cornice dati={{ ...dati, lingua, prodotti: { pm: 'attivo', crm: 'attivo' } }} onLogout={esciSenzaEffetto}><p id="pagina">La pagina</p></Cornice>);
        expect(uno('#pagina')?.textContent).toBe('La pagina');
        expect(uno('.zr-bell')).not.toBeNull();
        expect((uno('.zr-search input') as HTMLInputElement).placeholder).toBe(segnaposto);
        await act(async () => uno('.zr-search input')?.focus());

        expect(uno('.zr-search-note')?.textContent).toBe(invito);
    });

    it('l\'ingresso del pacchetto esporta il registro e nomeDellaVoce, per chi mostra i prodotti fuori dalla cornice (T7.2)', async () => {
        const ingresso = await import('./index');

        expect(ingresso.registro.map((voce) => ingresso.nomeDellaVoce(voce, 'en')))
            .toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Reports', 'Automations', 'Content']);
    });

    // Sprint 26 · T8 (voce #1792): dal 12/10/2026 il CRM è per tutti, e nel registro non è più in arrivo.
    it('l\'ingresso del pacchetto dà su ogni voce del registro `in_arrivo`: i prodotti che chi non ha una sessione vede «In arrivo», distinti da quelli «Presto»; il CRM non lo è più (sprint 16 · T7.3; sprint 26 · T8.2)', async () => {
        const ingresso = await import('./index');

        // Come lo legge una pagina senza sessione: `voce.in_arrivo`, un sì o un no su ogni voce.
        expect(ingresso.registro.filter((voce) => voce.in_arrivo).map((voce) => voce.id)).toStrictEqual(['bookings', 'reports', 'automations', 'content']);
        expect(ingresso.registro.filter((voce) => !voce.in_arrivo).map((voce) => voce.id)).toStrictEqual(['home', 'pm', 'crm']);
        expect(ingresso.registro.map((voce) => typeof voce.in_arrivo)).toStrictEqual(ordine.map(() => 'boolean'));
        // «Presto» è un'altra cosa, e non cambia: Bookings è in arrivo senza essere «Presto», e il CRM non è né l'uno né l'altro.
        expect(ingresso.registro.filter((voce) => voce.presto).map((voce) => voce.id)).toStrictEqual(['reports', 'automations', 'content']);
    });

    it.each<[DatiDellaCornice['prodotti'], string[]]>([
        [{ crm: 'attivo', bookings: 'disponibile' }, ['crm', 'bookings']],
        [{ bookings: 'attivo' }, ['bookings']],
        [{ crm: 'disponibile' }, ['crm']],
        [{ crm: 'in_arrivo', bookings: 'in_arrivo' }, []],
    ])('la cornice non legge `in_arrivo` del registro: un prodotto in arrivo per chi non ha una sessione si apre nel workspace dove il backoffice lo dà `attivo` o `disponibile` (sprint 16 · T7.2, %j)', async (prodotti, aperti) => {
        const { registro } = await import('./index');
        // La premessa: per il registro Bookings è in arrivo (fino alla `v1.15.0` lo era anche il CRM). Se la cornice lo leggesse come
        // «Presto», qui non si aprirebbe.
        expect(registro.filter((voce) => voce.in_arrivo && !voce.presto).map((voce) => voce.id)).toStrictEqual(['bookings']);

        await mostra(<Cornice dati={{ ...dati, prodotti }} onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        const voci = tutti('.zr-nav .zr-nav-group a.zr-nav-item').slice(2, 4);
        expect(voci.map((voce) => voce.querySelector('.zr-nav-label')?.textContent)).toStrictEqual(['CRM', 'Bookings']);
        expect(voci.map((voce) => voce.getAttribute('href')))
            .toStrictEqual(['crm', 'bookings'].map((id) => (aperti.includes(id) ? `${indirizzi[id]}/w/acme-marketing` : '#')));
        expect(voci.map((voce) => voce.querySelector('.zr-nav-soon')?.textContent ?? null))
            .toStrictEqual(['crm', 'bookings'].map((id) => (aperti.includes(id) ? null : 'Presto')));
    });

    it.each(['es', 'en'])('con la lingua "%s" nei dati ogni testo della cornice è in quella lingua: nessuno resta italiano (T6.3)', async (lingua) => {
        // I due testi della ricerca sono quelli delle fonti del workspace (sprint 25 · T4.3): gli altri, quelli della lingua.
        const attesi = { ...testi(lingua), ...testiDellaRicerca(lingua, fontiDeiDati) };
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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

    it.each(['board', 'home'])('con product="%s", che non è un prodotto del registro, il menu Moduli resta esteso', async (prodotto) => {
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, workspace: { nome: 'Marketing', slug }, aziende: aziendeDeiDati }} onLogout={esciSenzaEffetto} />);

        const workspace = appShell.mock.lastCall?.[0].companies?.flatMap((azienda) => azienda.workspaces).filter((ws) => ws.slug === slug);
        expect(workspace?.map((ws) => ws.tone)).toStrictEqual(['plum']);
    });

    it('lo stesso nome, lo stesso slug e lo stesso posto con un altro id: un altro tono (sprint 17 · T4.1)', async () => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={{ ...dati, aziende: [zeta, { ...acme, workspace: [vendite, { ...marketing, id: 'ws-5' }] }] }} onLogout={esciSenzaEffetto} />);

        expect(appShell.mock.lastCall?.[0].companies?.map((azienda) => azienda.workspaces.map((ws) => ws.tone))).toStrictEqual([['citrus'], ['coral', 'sky']]);
    });

    it.each<[string, unknown]>([
        ['senza id', undefined],
        ['con un id vuoto', ''],
        ['con un id che non è un testo', 5],
        ['con un id null', null],
    ])('un workspace %s non ha tono, e il suo pallino è quello che il design system mette da sé; gli altri hanno il loro (sprint 17 · T4.4)', async (_caso, id) => {
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
     * prodotto resta quello di `app`; le altre non hanno `tipo`, e hanno il titolo di ripiego. `soggetto` e il campo della bozza
     * (`motivo`) la parte server non li dà: se arrivassero lo stesso il pannello non li userebbe. Nessuna dice per chi è
     * (`per_me`), come il backoffice fino allo sprint 20: stanno tutte in «Per me» come in «Tutte».
     */
    const diOgniApp = [
        { id: 'uat-n47', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm', motivo: 'menzione' },
        { id: 'uat-n46', creata_il: '2026-10-05T12:00:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.board.cartella.creata', soggetto: '/v1/board/cartelle/uat-cartella-1' },
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
        // «Per me», poi «Tutte»: le stesse notifiche, perché nessuna dice per chi è.
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

    // Sprint 20 · T1 (voce #1674): chi, su che cosa e per chi. I tre dati sono del backoffice, e la parte server li dà quando ci
    // sono: `autore_nome`, `risorsa_nome`, `per_me`. Senza, il pannello è quello di prima.

    /** Una notifica non letta di una cartella nuova di Project Management, coi dati in più che il caso le dà. */
    const conInPiu = (id: string, inPiu: Record<string, unknown> = {}) => ({ id, creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm', tipo: 'com.zeiras.board.cartella.creata', ...inPiu });
    /** Apre la campanella su quell'elenco. */
    const apriSu = async (elenco: unknown[]) => {
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
    };
    const schede = () => tutti('.zr-notif-tabs [role="tab"]');
    const secondeRighe = () => voci().map((voce) => voce.querySelector('.zr-notif-sub')?.textContent ?? null);
    /** Le righe di ogni notifica, nell'ordine in cui stanno: il titolo, la seconda riga se c'è, il prodotto con l'ora. */
    const righe = () => voci().map((voce) => [...(voce.querySelector('.zr-notif-text')?.children ?? [])].map((riga) => riga.className));

    it('una notifica con `risorsa_nome` ha una seconda riga con quel testo, sotto il titolo; con `null`, un testo vuoto o di soli spazi, senza la chiave, o con un valore che non è un testo, la seconda riga non c\'è (sprint 20 · T1.1)', async () => {
        await apriSu([
            conInPiu('uat-n51', { risorsa_nome: 'UAT Clienti' }),
            conInPiu('uat-n52', { risorsa_nome: null }),
            conInPiu('uat-n53', { risorsa_nome: '' }),
            conInPiu('uat-n54', { risorsa_nome: ' \t\n ' }),
            conInPiu('uat-n55'),
            // Gli spazi intorno non sono del nome.
            conInPiu('uat-n56', { risorsa_nome: '  UAT Lancio Q4 ' }),
            // La parte server non li dà: se arrivassero lo stesso, non sono un testo da mostrare.
            conInPiu('uat-n57', { risorsa_nome: 7 }),
            conInPiu('uat-n58', { risorsa_nome: { nome: 'UAT oggetto' } }),
        ]);

        // Mai «null», un testo vuoto, l'id o il tipo dell'evento: o il nome, o niente.
        expect(secondeRighe()).toStrictEqual(['UAT Clienti', null, null, null, null, 'UAT Lancio Q4', null, null]);
        const senza = ['zr-notif-title', 'zr-notif-meta'];
        const con = ['zr-notif-title', 'zr-notif-sub', 'zr-notif-meta'];
        expect(righe()).toStrictEqual([con, senza, senza, senza, senza, con, senza, senza]);
        // Il titolo resta quello del tipo, e il prodotto con l'ora restano dov'erano.
        expect(titoli()).toStrictEqual(Array(8).fill('Nuova cartella'));
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(Array(8).fill('Project Management · 5 minuti fa'));
    });

    /** Una notifica su un'app: il backoffice dà in `risorsa_nome` il codice dell'app, non un nome. */
    const suUnApp = (id: string, risorsa_nome: unknown, tipo = 'com.zeiras.app.modificata') => conInPiu(id, { app: null, tipo, risorsa_nome });

    it('una notifica su un\'app (un tipo `com.zeiras.app.…`) arriva con `risorsa_nome` uguale al codice dell\'app: la seconda riga è il nome del prodotto, dal registro e nella lingua, mai il codice; con un codice che il registro non ha non c\'è; per ogni altro tipo «pm» è un nome come un altro (sprint 20 · T1.8)', async () => {
        await apriSu([
            suUnApp('uat-n51', 'pm'),
            // Anche un prodotto «Presto», o che il workspace non ha attivo: come per `app`.
            suUnApp('uat-n52', 'reports'),
            suUnApp('uat-n53', ' crm '),
            // Un codice che il registro non ha, la Dashboard, lo stesso codice scritto in un altro modo: niente, mai il codice.
            suUnApp('uat-n54', 'uat-app-nuova'),
            suUnApp('uat-n55', 'home'),
            suUnApp('uat-n56', 'PM'),
            suUnApp('uat-n57', null),
            // Un tipo della stessa famiglia che le lingue non hanno ancora: il titolo di ripiego, e la stessa regola.
            suUnApp('uat-n58', 'pm', 'com.zeiras.app.uat-nuovo'),
            suUnApp('uat-n59', 'uat-app-nuova', 'com.zeiras.app.uat-nuovo'),
            // Una cartella che si chiama «pm»: è il suo nome, e resta.
            conInPiu('uat-n60', { app: null, risorsa_nome: 'pm' }),
            // Due tipi che cominciano allo stesso modo ma non sono di quella famiglia.
            conInPiu('uat-n61', { app: null, tipo: 'com.zeiras.applicazione.uat', risorsa_nome: 'pm' }),
            conInPiu('uat-n62', { app: null, tipo: 'com.zeiras.app', risorsa_nome: 'pm' }),
        ]);

        expect(secondeRighe()).toStrictEqual(['Project Management', 'Report', 'CRM', null, null, null, null, 'Project Management', null, 'pm', 'pm', 'pm']);
        expect(titoli()).toStrictEqual([
            ...Array(7).fill('Un modulo è stato attivato o disattivato'), 'Novità nel workspace', 'Novità nel workspace', 'Nuova cartella', 'Novità nel workspace', 'Novità nel workspace',
        ]);
        // Il nome sta nella seconda riga e solo lì: davanti all'ora c'è il prodotto di `app`, che queste notifiche non hanno.
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(Array(12).fill('5 minuti fa'));
        expect(voci().slice(0, 9).map((voce) => /\bpm\b|reports|crm|uat-app-nuova|home/.test(voce.textContent ?? ''))).toStrictEqual(Array(9).fill(false));
    });

    it.each([
        ['es', 'Gestión de proyectos', 'Informes'],
        ['en', 'Project Management', 'Reports'],
        // Una lingua che zr-core non ha: l'inglese, come per ogni altro testo.
        ['fr', 'Project Management', 'Reports'],
    ] as const)('con la lingua "%s" il nome del prodotto di una notifica su un\'app è quello che il prodotto ha in quella lingua (sprint 20 · T1.8)', async (lingua, pm, reports) => {
        vi.stubGlobal('fetch', rotte([suUnApp('uat-n51', 'pm'), suUnApp('uat-n52', 'reports'), conInPiu('uat-n53', { risorsa_nome: 'pm' })]));
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        expect(secondeRighe()).toStrictEqual([pm, reports, 'pm']);
    });

    it('una notifica con `autore_nome` ha, al posto dell\'icona, l\'avatar con le iniziali di quel nome; con `null`, un nome vuoto o di soli spazi, senza la chiave, o con un valore che non è un testo, resta l\'icona di prima; il nome non entra nel titolo né nella seconda riga (sprint 20 · T1.2)', async () => {
        await apriSu([
            conInPiu('uat-n51', { autore_nome: 'Marta Rossi' }),
            conInPiu('uat-n52', { autore_nome: null }),
            conInPiu('uat-n53', { autore_nome: '' }),
            conInPiu('uat-n54', { autore_nome: '   ' }),
            conInPiu('uat-n55'),
            // Anche su una notifica che non è di un prodotto: l'avatar al posto della campanella.
            conInPiu('uat-n56', { autore_nome: ' Bruno ', app: null }),
            conInPiu('uat-n57', { app: null }),
            // La parte server passa solo il nome: se arrivasse lo stesso l'oggetto del backoffice, non è un nome.
            conInPiu('uat-n58', { autore_nome: { nome: 'UAT oggetto', email: 'uat@example.com' } }),
            conInPiu('uat-n59', { autore: { nome: 'UAT oggetto' } }),
        ]);

        const avatar = (voce: HTMLElement) => voce.querySelector('.zr-avatar');
        expect(voci().map((voce) => avatar(voce)?.textContent ?? null)).toStrictEqual(['MR', null, null, null, null, 'B', null, null, null]);
        expect(voci().map((voce) => avatar(voce)?.getAttribute('aria-label') ?? null)).toStrictEqual(['Marta Rossi', null, null, null, null, 'Bruno', null, null, null]);
        // Dove c'è l'avatar l'icona non c'è; altrove è quella di prima: del prodotto, o la campanella.
        expect(voci().map((voce) => voce.querySelector('.zr-iconbox path')?.getAttribute('d') ?? null)).toStrictEqual([
            null, ...(['board', 'board', 'board', 'board'] as const).map(tracciatoDi), null, tracciatoDi('bell'), tracciatoDi('board'), tracciatoDi('board'),
        ]);
        expect(voci().map((voce) => voce.querySelectorAll('.zr-avatar, .zr-iconbox').length)).toStrictEqual(Array(9).fill(1));
        // Il nome di chi l'ha fatto sta nell'avatar: non nel titolo, e non al posto del nome della cosa.
        expect(titoli()).toStrictEqual(Array(9).fill('Nuova cartella'));
        expect(secondeRighe()).toStrictEqual(Array(9).fill(null));
        expect(uno('.zr-notif-list')?.textContent).not.toMatch(/Marta|Bruno|UAT oggetto|example\.com/);
    });

    it('`per_me` dice in quale scheda sta una notifica: `true` in «Per me» e in «Tutte», `false` solo in «Tutte»; `null`, senza la chiave o con un valore che non è un booleano, in tutte e due, come prima (sprint 20 · T1.3)', async () => {
        await apriSu([
            conInPiu('uat-n51', { per_me: true, risorsa_nome: 'UAT diretta a me' }),
            conInPiu('uat-n52', { per_me: false, risorsa_nome: 'UAT per tutti' }),
            conInPiu('uat-n53', { per_me: null, risorsa_nome: 'UAT non detto' }),
            conInPiu('uat-n54', { risorsa_nome: 'UAT senza la chiave' }),
            // La parte server dà un booleano o `null`: un altro valore non dice niente, e non toglie la notifica da «Per me».
            conInPiu('uat-n55', { per_me: 0, risorsa_nome: 'UAT zero' }),
            conInPiu('uat-n56', { per_me: 'false', risorsa_nome: 'UAT testo' }),
        ]);

        const perMe = ['UAT diretta a me', 'UAT non detto', 'UAT senza la chiave', 'UAT zero', 'UAT testo'];
        const tutte = ['UAT diretta a me', 'UAT per tutti', 'UAT non detto', 'UAT senza la chiave', 'UAT zero', 'UAT testo'];
        // Il pannello si apre su «Per me».
        expect(schede().map((scheda) => scheda.getAttribute('aria-selected'))).toStrictEqual(['true', 'false']);
        expect(secondeRighe()).toStrictEqual(perMe);
        await clic(schede()[1]);
        expect(secondeRighe()).toStrictEqual(tutte);
        await clic(schede()[0]);
        expect(secondeRighe()).toStrictEqual(perMe);
    });

    it('all\'`AppShell` `forMe` arriva solo quando `per_me` è un booleano, ed è quel booleano: con `null`, senza la chiave o con un valore che non è un booleano la chiave non c\'è, nemmeno con `undefined` o col valore com\'è (sprint 20 · T1.3; review, R3)', async () => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        await apriSu([
            conInPiu('uat-n51', { per_me: true }),
            conInPiu('uat-n52', { per_me: false }),
            conInPiu('uat-n53', { per_me: null }),
            conInPiu('uat-n54'),
            // Nel pannello di oggi questi stanno in «Per me» anche se passano com'è: l'`AppShell` toglie solo `false`. Si guarda
            // ciò che gli arriva, perché un `AppShell` di domani potrebbe leggere `forMe` in un altro modo.
            conInPiu('uat-n55', { per_me: 0 }),
            conInPiu('uat-n56', { per_me: 'false' }),
            conInPiu('uat-n57', { per_me: 1 }),
            conInPiu('uat-n58', { per_me: 'true' }),
        ]);

        const date = appShell.mock.lastCall?.[0].notifications ?? [];
        expect(date.map((notifica) => notifica.id)).toStrictEqual(['uat-n51', 'uat-n52', 'uat-n53', 'uat-n54', 'uat-n55', 'uat-n56', 'uat-n57', 'uat-n58']);
        expect(date.map((notifica) => ('forMe' in notifica ? notifica.forMe : 'manca'))).toStrictEqual([true, false, 'manca', 'manca', 'manca', 'manca', 'manca', 'manca']);
    });

    it('con le sole notifiche che non sono per me «Per me» è vuota e «Tutte» le mostra: la campanella conta le non lette di tutte e due (sprint 20 · T1.3)', async () => {
        await apriSu([conInPiu('uat-n51', { per_me: false }), conInPiu('uat-n52', { per_me: false, letta: true })]);

        expect(voci()).toHaveLength(0);
        expect(uno('.zr-notif .zr-empty')).not.toBeNull();
        expect(campanella()).toBe('1');
        await clic(schede()[1]);
        expect(nonLette()).toStrictEqual([true, false]);
        expect(uno('.zr-notif .zr-empty')).toBeNull();
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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
        const appShell = vi.spyOn(componenti, 'AppShell');
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

    // Sprint 23 · T1. Con due schede su due workspace l'elenco in pagina può essere di un altro workspace rispetto ai dati: lì
    // «Segna tutte come lette» non può funzionare (la parte server risponde 409 `workspace_diverso`), e il pulsante non c'è. Lo
    // dice la parte server, con `workspace` nella risposta dell'elenco: se non lo dice, il pulsante c'è come nella v1.12.0.

    /** Come `rotte`, con ciò che la parte server dice dell'elenco a ogni caricamento (finiti, l'ultimo): di quale workspace è. */
    const rotteCheDicono = (...aOgniCaricamento: { workspace?: string }[]) => {
        let caricamenti = 0;

        return vi.fn(async (indirizzo: string, opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche' ? risposta({ data: notificheDelServer, ...aOgniCaricamento[Math.min(caricamenti++, aOgniCaricamento.length - 1)] }) : segnateFinoA(opzioni)));
    };

    it.each([
        ['col numero dei dati', { ...dati, non_lette: 2 }, '2'],
        ['con un numero più alto delle non lette caricate', { ...dati, non_lette: 9 }, '9'],
        ['senza il numero nei dati', dati, '2'],
    ] satisfies [string, DatiDellaCornice, string][])('con un elenco che la parte server dice di un altro workspace il pannello non ha «Segna tutte come lette», %s, e nessuna lettura parte (sprint 23 · T1.1)', async (_come, dellaPagina, sullaCampanella) => {
        const fetchFinto = rotteCheDicono({ workspace: 'acme-vendite' });
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={dellaPagina} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        // L'elenco è arrivato e la campanella ha un numero: il pulsante manca per il workspace, non perché non c'è niente da segnare.
        expect([voci().length, campanella()]).toStrictEqual([3, sullaCampanella]);
        expect(segnaTutte()).toBeNull();
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
    });

    it.each([
        ['dice il workspace dei dati', { workspace: 'acme-marketing' }],
        ['non dice di quale workspace è l\'elenco', {}],
    ] satisfies [string, { workspace?: string }][])('con una parte server che %s il pulsante c\'è come nella v1.12.0, e manda lo slug dei dati con cui l\'elenco è stato chiesto (sprint 23 · T1.2)', async (_quale, dellElenco) => {
        const fetchFinto = rotteCheDicono(dellElenco);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');

        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[1]?.[1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
    });

    it('se i dati passano a un altro workspace a pannello aperto e la parte server dice di quale workspace è l\'elenco, il pulsante non c\'è finché in pagina c\'è l\'elenco del workspace di prima, e torna con l\'elenco del workspace dei dati (sprint 23 · T1.3)', async () => {
        const fetchFinto = rotteCheDicono({ workspace: 'acme-marketing' }, { workspace: 'acme-vendite' });
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');

        // La cornice resta montata e i dati sono di un altro workspace: l'elenco in pagina è ancora quello di prima, e lo dice.
        const altrove = { ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' }, non_lette: 5 };
        await mostra(<Cornice dati={altrove} onLogout={esciSenzaEffetto} />);
        expect([voci().length, campanella()]).toStrictEqual([3, '5']);
        expect(segnaTutte()).toBeNull();
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);

        // Chiuso e riaperto, il pannello chiede l'elenco coi dati di adesso: è del loro workspace, e il pulsante torna.
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[2]?.[1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-vendite' });
    });

    // Sprint 24 · T4 (voce #1754; lettura della PR #51, R3). L'elenco chiesto coi dati di un workspace può essere, per la parte
    // server, di un altro: la sessione è passata lì da un'altra scheda. Il pulsante manderebbe lo slug dei dati con cui
    // l'elenco è stato chiesto, e la rotta risponderebbe 409: non c'è nemmeno quando i dati della pagina passano a quel
    // workspace con la cornice montata, perché l'elenco in pagina è ancora quello chiesto coi dati di prima.
    it('se l\'elenco è stato chiesto coi dati di un workspace, la parte server lo dice di un altro e poi i dati passano a quell\'altro con la cornice montata, «Segna tutte come lette» non c\'è: manderebbe lo slug dei dati di prima; torna con l\'elenco chiesto coi dati di adesso (sprint 24 · T4.1)', async () => {
        const fetchFinto = rotteCheDicono({ workspace: 'acme-vendite' });
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 2 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(segnaTutte()).toBeNull();

        // La cornice resta montata e i dati sono del workspace che la parte server ha detto: l'elenco in pagina è suo, ma è
        // stato chiesto coi dati dell'altro.
        const altrove = { ...dati, workspace: { nome: 'Vendite', slug: 'acme-vendite' }, non_lette: 5 };
        await mostra(<Cornice dati={altrove} onLogout={esciSenzaEffetto} />);
        expect([voci().length, campanella()]).toStrictEqual([3, '5']);
        expect(segnaTutte()).toBeNull();
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);

        // Chiuso e riaperto, il pannello chiede l'elenco coi dati di adesso: il pulsante torna, e manda il loro slug.
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(segnaTutte()?.textContent).toBe('Segna tutte come lette');
        await clic(segnaTutte());
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'GET /cornice/notifiche', 'POST /cornice/notifiche/letture']);
        expect(corpoDi(fetchFinto.mock.calls[2]?.[1])).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-vendite' });
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

    it('il clic su una notifica che non ha una destinazione nel registro e «Vedi tutte» aprono la pagina delle notifiche su app.zeiras.com, anche da un prodotto (sprint 5 · T3.6; sprint 21 · T3.2)', async () => {
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

    // Sprint 21 · T3 (voce #1641): da una notifica si apre la sua risorsa. Dove, lo dice il registro (`notifiche` della voce del
    // prodotto, col tipo intero), e gli id li porta la notifica (`ids`, dalla parte server): senza una destinazione, o senza
    // l'id che il percorso chiede, o in un workspace dove il modulo non si può aprire, resta la pagina delle notifiche.
    const paginaDelleNotifiche = 'https://app.zeiras.com/notifiche';
    const nelCrm = 'https://crm.zeiras.com/w/acme-marketing';
    /**
     * Notifiche con gli id che la parte server dà di `dati`, dalla più recente. Le prime tre hanno la loro destinazione nel
     * registro: un contatto, una pipeline, una nota (che apre il contatto a cui è attaccata, anche da eliminata). Le altre no:
     * una nota senza il contatto, una col contatto malfatto, una di Project Management che non ha una pagina (una scheda
     * eliminata: dallo sprint 24 una scheda nuova, modificata o assegnata si apre, più sotto), una del workspace, una del CRM
     * di un tipo che zr-core non conosce ancora, e una come la dà una parte server di prima, senza `ids`.
     */
    const conGliId = [
        { id: 'uat-n59', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } },
        { id: 'uat-n58', creata_il: '2026-10-06T11:50:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.pipeline.modificata', ids: { id: 'uat-pipeline-1' } },
        { id: 'uat-n57', creata_il: '2026-10-06T11:45:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.eliminata', ids: { id: 'uat-nota-1', persona_id: 'uat-persona-2' } },
        { id: 'uat-n56', creata_il: '2026-10-06T11:40:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.creata', ids: { id: 'uat-nota-2' } },
        { id: 'uat-n55', creata_il: '2026-10-06T11:35:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.creata', ids: { id: 'uat-nota-3', persona_id: '../x' } },
        { id: 'uat-n54', creata_il: '2026-10-06T11:30:00Z', letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', ids: { id: 'uat-scheda-1', board_id: 'uat-board-1' } },
        { id: 'uat-n53', creata_il: '2026-10-06T11:25:00Z', letta: true, app: null, tipo: 'com.zeiras.workspace.membro.creato', ids: {} },
        { id: 'uat-n52', creata_il: '2026-10-06T11:20:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.persona.assegnata', ids: { id: 'uat-persona-1' } },
        { id: 'uat-n51', creata_il: '2026-10-06T11:15:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.persona.creata' },
    ];

    /**
     * Gli indirizzi che la cornice apre con un clic su ognuna di quelle notifiche, una alla volta: a ogni clic il pannello si
     * chiude. `dellElenco` è ciò che la parte server dice accanto a `data`: se non lo si dà, che l'elenco è del workspace della
     * pagina (`workspace`, dalla `v1.12.0`), come succede con una scheda sola.
     */
    async function apertiDalPannello(datiDellaPagina: DatiDellaCornice, prodotto?: string, elenco: { id: string }[] = conGliId, dellElenco: Record<string, unknown> = { workspace: datiDellaPagina.workspace.slug }): Promise<unknown[]> {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: elenco, ...dellElenco })));
        const naviga = vi.fn();
        await mostra(<Cornice dati={datiDellaPagina} product={prodotto} naviga={naviga} onLogout={esciSenzaEffetto} />);
        for (let indice = 0; indice < elenco.length; indice++) {
            await clic(uno('.zr-bell'));
            expect(voci()).toHaveLength(elenco.length);
            await clic(voci()[indice] ?? null);
            expect(uno('.zr-notif')).toBeNull();
        }

        expect(naviga.mock.calls.every((chiamata) => chiamata.length === 1)).toBe(true);

        return naviga.mock.calls.map(([indirizzo]) => indirizzo);
    }

    it.each([[undefined], ['pm'], ['crm']])('un clic su una notifica del CRM apre la sua risorsa nel CRM, nel workspace dei dati: il contatto, le impostazioni della pipeline, e per una nota il contatto a cui è attaccata; ogni altra apre la pagina delle notifiche — dal prodotto «%s» (sprint 21 · T3.1, T3.2, T3.3)', async (prodotto) => {
        expect(await apertiDalPannello(dati, prodotto)).toStrictEqual([
            `${nelCrm}/contatti/uat-persona-1`,
            `${nelCrm}/pipeline/uat-pipeline-1/impostazioni`,
            // Il contatto della nota, non la nota.
            `${nelCrm}/contatti/uat-persona-2`,
            // Senza l'id che il percorso chiede, o con un id malfatto: mai un indirizzo composto a metà.
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            // Senza una destinazione nel registro: di Project Management, del workspace, di un tipo che zr-core non conosce.
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            // Senza `ids`.
            paginaDelleNotifiche,
        ]);
    });

    it.each([
        ['il backoffice lo dà in arrivo', { pm: 'attivo', crm: 'in_arrivo' }],
        ['i dati non lo elencano', { pm: 'attivo' }],
        ['il suo stato è scritto `undefined`', { pm: 'attivo', crm: undefined }],
    ] satisfies [string, DatiDellaCornice['prodotti']][])('in un workspace dove il CRM non si può aprire — %s — un clic su una sua notifica apre la pagina delle notifiche, mai il CRM (sprint 21 · T3.4)', async (_quale, prodotti) => {
        expect(await apertiDalPannello({ ...dati, prodotti })).toStrictEqual(conGliId.map(() => paginaDelleNotifiche));
    });

    // Sprint 23 · T3 (voce #1743): i nove tipi che dallo sprint 22 (T5, voce #1720) avevano un titolo e nessuna destinazione ora
    // aprono la loro risorsa nel CRM, coi nomi delle pagine di zr-crm: l'opportunità, il contatto o l'azienda assegnati, e per
    // un'attività «Da fare», senza il suo id — dalla parte server i suoi `ids` arrivano vuoti. Nel workspace dell'elenco, come
    // le altre: anche quando non è quello dei dati della pagina.
    it.each<[string, string | undefined, Record<string, unknown> | undefined, string]>([
        ['il workspace dei dati', 'crm', undefined, 'https://crm.zeiras.com/w/acme-marketing'],
        ['un altro workspace', 'pm', { workspace: 'acme-vendite' }, 'https://crm.zeiras.com/w/acme-vendite'],
    ])('un clic su una notifica di un\'opportunità, di un\'attività o di ciò che viene assegnato apre la sua pagina nel CRM, nel workspace dell\'elenco — %s —: l\'opportunità, il contatto e l\'azienda col loro id, «Da fare» senza (sprint 23 · T3.1, T3.2, T3.3)', async (_quale, prodotto, dellElenco, nelWorkspace) => {
        const tipi = [
            ['com.zeiras.crm.trattativa.creata', '/opportunita/uat-x-1'], ['com.zeiras.crm.trattativa.modificata', '/opportunita/uat-x-2'],
            ['com.zeiras.crm.attivita.creata', '/da-fare'], ['com.zeiras.crm.attivita.modificata', '/da-fare'], ['com.zeiras.crm.attivita.eliminata', '/da-fare'],
            ['crm.persona.assegnata', '/contatti/uat-x-6'], ['crm.organizzazione.assegnata', '/aziende/uat-x-7'], ['crm.trattativa.assegnata', '/opportunita/uat-x-8'], ['crm.attivita.assegnata', '/da-fare'],
        ] satisfies [string, string][];
        const elenco = tipi.map(([tipo, percorso], indice) => ({ id: `uat-n${80 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: true, app: 'crm', tipo, ids: percorso === '/da-fare' ? {} : { id: `uat-x-${indice + 1}` } }));

        expect(await apertiDalPannello(dati, prodotto, elenco, dellElenco)).toStrictEqual(tipi.map(([, percorso]) => nelWorkspace + percorso));
    });

    it('un clic su una nota apre la cosa più specifica a cui è legata — l\'opportunità, poi il contatto, poi l\'azienda —, e senza un legame in forma la pagina delle notifiche (sprint 23 · T3.4)', async () => {
        const note = [
            // Come la dà la parte server: i soli id del percorso che si apre.
            [{ trattativa_id: 'uat-opp-1' }, `${nelCrm}/opportunita/uat-opp-1`],
            [{ persona_id: 'uat-persona-2' }, `${nelCrm}/contatti/uat-persona-2`],
            [{ organizzazione_id: 'uat-azienda-3' }, `${nelCrm}/aziende/uat-azienda-3`],
            // Con tutti e tre i legami vince l'opportunità; con un'opportunità fuori forma si prova il percorso dopo.
            [{ trattativa_id: 'uat-opp-1', persona_id: 'uat-persona-2', organizzazione_id: 'uat-azienda-3' }, `${nelCrm}/opportunita/uat-opp-1`],
            [{ trattativa_id: '../x', organizzazione_id: 'uat-azienda-3' }, `${nelCrm}/aziende/uat-azienda-3`],
            [{ id: 'uat-nota-9' }, paginaDelleNotifiche],
            [{ trattativa_id: '../x', persona_id: 'uat/persona' }, paginaDelleNotifiche],
        ] satisfies [Record<string, string>, string][];
        const quando = ['creata', 'modificata', 'eliminata'];
        const elenco = note.map(([ids], indice) => ({ id: `uat-n${70 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: true, app: 'crm', tipo: `com.zeiras.crm.nota.${quando[indice % 3]}`, ids }));

        expect(await apertiDalPannello(dati, 'crm', elenco)).toStrictEqual(note.map(([, indirizzo]) => indirizzo));
    });

    it('la funzione che il pacchetto esporta dà, per ogni notifica, l\'indirizzo che apre il pannello, e niente quando il pannello apre la pagina delle notifiche (sprint 21 · T3.6)', async () => {
        const dellaFunzione = (prodotti: DatiDellaCornice['prodotti']) => conGliId.map((notifica) => destinazioneDellaNotifica(notifica, dati.workspace.slug, prodotti));

        // Non è un confronto fra due vuoti: tre hanno una destinazione, le altre no.
        expect(dellaFunzione(dati.prodotti).map((indirizzo) => indirizzo !== undefined)).toStrictEqual([true, true, true, false, false, false, false, false, false]);
        expect(await apertiDalPannello(dati)).toStrictEqual(dellaFunzione(dati.prodotti).map((indirizzo) => indirizzo ?? paginaDelleNotifiche));
        // Anche dove il CRM non si può aprire: tutte e due dicono di no.
        const senzaCrm: DatiDellaCornice['prodotti'] = { pm: 'attivo' };
        expect(dellaFunzione(senzaCrm)).toStrictEqual(conGliId.map(() => undefined));
    });

    // Sprint 21 · T5 (voce #1706): una vista salvata è di Project Management, che nel registro non ha destinazioni. Gli id
    // la notifica li porta lo stesso (`id`, `board_id`): un indirizzo per una vista non lo decide zr-core.
    const delleViste = ['creata', 'modificata', 'eliminata'].map((cosa, indice) => ({
        id: `uat-n${69 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm', tipo: `com.zeiras.board.vista.${cosa}`, ids: { id: 'uat-vista-1', board_id: 'uat-board-1' },
    }));

    it.each([[undefined], ['pm'], ['crm']])('un clic su una notifica di una vista di una board apre la pagina delle notifiche, come le altre di Project Management, mai una pagina del modulo — dal prodotto «%s» (sprint 21 · T5.2)', async (prodotto) => {
        expect(await apertiDalPannello(dati, prodotto, delleViste)).toStrictEqual([paginaDelleNotifiche, paginaDelleNotifiche, paginaDelleNotifiche]);
        expect(delleViste.map((notifica) => destinazioneDellaNotifica(notifica, dati.workspace.slug, dati.prodotti))).toStrictEqual([undefined, undefined, undefined]);
    });

    // Un'azienda del CRM, che nel contratto è una `organizzazione`: creata o modificata, si apre la sua pagina in `/aziende`.
    const delleAziende = ['creata', 'modificata'].map((cosa, indice) => ({
        id: `uat-n${79 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: `com.zeiras.crm.organizzazione.${cosa}`, ids: { id: `uat-azienda-${indice + 1}` },
    }));

    it.each([[undefined], ['pm'], ['crm']])('un clic su una notifica di un\'azienda del CRM apre la pagina di quell\'azienda, `/aziende/<id>` dopo `/w/<slug>`, mai `/organizzazioni/<id>` — dal prodotto «%s» (sprint 21 · T5.2)', async (prodotto) => {
        expect(await apertiDalPannello(dati, prodotto, delleAziende)).toStrictEqual([`${nelCrm}/aziende/uat-azienda-1`, `${nelCrm}/aziende/uat-azienda-2`]);
    });

    it('in un workspace dove il CRM non si può aprire, un clic su una notifica di un\'azienda apre la pagina delle notifiche (sprint 21 · T5.2, T3.4)', async () => {
        expect(await apertiDalPannello({ ...dati, prodotti: { pm: 'attivo', crm: 'in_arrivo' } }, undefined, delleAziende)).toStrictEqual([paginaDelleNotifiche, paginaDelleNotifiche]);
    });

    // Sprint 22 · T1 (voce #1713): la sessione ha un workspace solo. Con due schede su due workspace, la scheda rimasta
    // indietro mostra ancora il suo, ma l'elenco che la parte server dà è di quello in cui la persona è entrata per ultimo: lo
    // dice la risposta (`workspace`), e l'indirizzo si compone con quello slug, mai con quello dei dati della pagina.
    const nelCrmDellAltro = 'https://crm.zeiras.com/w/acme-vendite';

    it.each([[undefined], ['pm'], ['crm']])('con l\'elenco di un altro workspace un clic apre la risorsa in quel workspace, mai in quello dei dati della pagina — dal prodotto «%s» (sprint 22 · T1.2)', async (prodotto) => {
        const aperti = await apertiDalPannello(dati, prodotto, conGliId, { workspace: 'acme-vendite' });

        expect(aperti).toStrictEqual([
            `${nelCrmDellAltro}/contatti/uat-persona-1`,
            `${nelCrmDellAltro}/pipeline/uat-pipeline-1/impostazioni`,
            `${nelCrmDellAltro}/contatti/uat-persona-2`,
            // Ciò che non ha dove andare resta alla pagina delle notifiche, in qualunque workspace sia l'elenco.
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            paginaDelleNotifiche,
            paginaDelleNotifiche,
        ]);
        expect(aperti.some((indirizzo) => String(indirizzo).includes('/w/acme-marketing'))).toBe(false);
        expect(await apertiDalPannello(dati, prodotto, delleAziende, { workspace: 'acme-vendite' })).toStrictEqual([`${nelCrmDellAltro}/aziende/uat-azienda-1`, `${nelCrmDellAltro}/aziende/uat-azienda-2`]);
    });

    it.each([
        ['il backoffice lo dà in arrivo', { pm: 'attivo', crm: 'in_arrivo' }],
        ['i dati non lo elencano', { pm: 'attivo' }],
        ['il suo stato è scritto `undefined`', { pm: 'attivo', crm: undefined }],
        ['i dati non elencano nessun modulo', {}],
    ] satisfies [string, DatiDellaCornice['prodotti']][])('con l\'elenco di un altro workspace lo stato dei moduli nei dati della pagina non decide: è di un altro workspace. Anche se lì il CRM non si può aprire — %s — la risorsa si apre nel workspace dell\'elenco (sprint 22 · T1.5)', async (_quale, prodotti) => {
        const dellaPagina = { ...dati, prodotti };

        expect((await apertiDalPannello(dellaPagina, undefined, conGliId, { workspace: 'acme-vendite' })).slice(0, 3)).toStrictEqual([
            `${nelCrmDellAltro}/contatti/uat-persona-1`,
            `${nelCrmDellAltro}/pipeline/uat-pipeline-1/impostazioni`,
            `${nelCrmDellAltro}/contatti/uat-persona-2`,
        ]);
        // Nel workspace della pagina, invece, lo stato dei suoi dati decide come prima.
        expect(await apertiDalPannello(dellaPagina)).toStrictEqual(conGliId.map(() => paginaDelleNotifiche));
    });

    it.each([
        ['la chiave manca', {}],
        ['è `null`', { workspace: null }],
        ['è un numero', { workspace: 7 }],
        ['è un oggetto con lo slug dentro', { workspace: { slug: 'acme-marketing' } }],
        ['è vuota', { workspace: '' }],
        ['è `..`', { workspace: '..' }],
        ['ha una barra', { workspace: 'acme-marketing/x' }],
        ['ha una maiuscola', { workspace: 'Acme-marketing' }],
        ['ha uno spazio in fondo', { workspace: 'acme-marketing ' }],
    ] satisfies [string, Record<string, unknown>][])('se la parte server non dice di quale workspace è l\'elenco — `workspace` %s — ogni clic apre la pagina delle notifiche, mai una risorsa nel workspace dei dati della pagina (sprint 22 · T1.3)', async (_quale, dellElenco) => {
        expect(await apertiDalPannello(dati, 'crm', conGliId, dellElenco)).toStrictEqual(conGliId.map(() => paginaDelleNotifiche));
        expect(await apertiDalPannello(dati, undefined, delleAziende, dellElenco)).toStrictEqual([paginaDelleNotifiche, paginaDelleNotifiche]);
    });

    it('con l\'elenco del workspace della pagina tutto è come prima: gli stessi indirizzi, e l\'elenco si mostra anche quando la parte server non dice di quale workspace è (sprint 22 · T1.4)', async () => {
        expect((await apertiDalPannello(dati)).slice(0, 3)).toStrictEqual([`${nelCrm}/contatti/uat-persona-1`, `${nelCrm}/pipeline/uat-pipeline-1/impostazioni`, `${nelCrm}/contatti/uat-persona-2`]);

        // Senza `workspace` non è un errore: il pannello mostra le notifiche, solo che un clic non sa dove aprirle.
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: conGliId })));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        expect(voci()).toHaveLength(conGliId.length);
        expect(uno('.zr-notif-state')).toBeNull();
    });

    // Sprint 22 · T2 (voce #1712): il clic che apre la risorsa di una notifica non letta la segna letta. La richiesta parte col
    // clic (`PATCH /cornice/notifiche/<id>/lettura`, con `keepalive` perché la pagina sta cambiando) e l'apertura non la
    // aspetta; il numero scende solo quando la parte server risponde `letta: true`, una volta sola, e un avviso che non si vede
    // lo dice a chi usa un lettore di schermo.

    /** Due non lette con la loro destinazione nel registro: un contatto e una pipeline del CRM. */
    const delContatto = { id: 'uat-n69', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } };
    const dellaPipeline = { id: 'uat-n68', creata_il: '2026-10-06T11:50:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.pipeline.modificata', ids: { id: 'uat-pipeline-1' } };
    /** Una già letta, con la sua destinazione: il contatto a cui la nota era attaccata. */
    const dellaNota = { id: 'uat-n67', creata_il: '2026-10-06T11:45:00Z', letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.eliminata', ids: { id: 'uat-nota-1', persona_id: 'uat-persona-2' } };
    /** Una non letta di Project Management che nel registro non ha dove andare, una scheda eliminata: il suo clic apre la pagina delle notifiche. */
    const dellaScheda = { id: 'uat-n66', creata_il: '2026-10-06T11:40:00Z', letta: false, app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', ids: {} };
    /** Le quattro, dalla più recente: tre non lette. */
    const daAprire = [delContatto, dellaPipeline, dellaNota, dellaScheda];
    const laLettura = (id: string) => `PATCH /cornice/notifiche/${id}/lettura`;
    /** La parte server ha segnato letta quella notifica; con `il`, in quell'istante (`segnata_il`, dalla `v1.12.0`). */
    const segnata = (id: string, il?: string) => risposta({ data: { id, letta: true }, ...(il === undefined ? {} : { segnata_il: il }) });
    /**
     * Le due rotte del clic. L'elenco: a ogni caricamento il prossimo di `elenchi` (l'ultimo si ripete), del workspace della
     * pagina se non ne dice un altro, con l'istante in cui è stato letto se lo si dà. La lettura di una notifica: ciò che
     * `allaLettura` risponde; se non lo si dà, `letta: true` senza istante. Un'altra richiesta è un errore del caso.
     */
    const rotteDelClic = (elenchi: { data: unknown[]; lettoIl?: string; workspace?: string }[], allaLettura: (id: string) => Response | Promise<Response> = (id) => segnata(id)) => {
        let caricamenti = 0;

        return vi.fn(async (indirizzo: string, opzioni?: RequestInit) => {
            if (indirizzo === '/cornice/notifiche') {
                const { data, lettoIl, workspace = dati.workspace.slug } = elenchi[Math.min(caricamenti++, elenchi.length - 1)] ?? { data: [] };

                return risposta({ data, workspace, ...(lettoIl === undefined ? {} : { aggiornati_il: lettoIl }) });
            }
            const id = /^\/cornice\/notifiche\/([^/]+)\/lettura$/.exec(indirizzo)?.[1];
            if (id === undefined || opzioni?.method !== 'PATCH') {
                throw new Error(`il caso non aspetta ${opzioni?.method ?? 'GET'} ${indirizzo}`);
            }

            return allaLettura(id);
        });
    };
    /** L'avviso della cornice per il lettore di schermo: accanto all'`AppShell`, non dentro. */
    const avviso = () => [...contenitore.children].find((figlio) => figlio.getAttribute('role') === 'status') ?? null;
    const detto = () => avviso()?.textContent ?? null;
    /** Apre la campanella e fa clic sulla notifica in quella posizione: il pannello si chiude. */
    const apre = async (indice: number) => {
        await clic(uno('.zr-bell'));
        await clic(voci()[indice] ?? null);
        expect(uno('.zr-notif')).toBeNull();
    };

    it('un clic su una notifica non letta che ha una destinazione chiede PATCH /cornice/notifiche/<id>/lettura con {"letta": true}, col gettone CSRF e con keepalive, e apre la risorsa: la richiesta parte prima dell\'apertura (sprint 22 · T2.1)', async () => {
        cookieCsrf('eyJpdiI6Ik1h%3D%3D');
        const fetchFinto = rotteDelClic([{ data: daAprire }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 3 }} product="crm" naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', laLettura('uat-n69')]);
        const opzioni = fetchFinto.mock.calls[1]?.[1];
        expect([opzioni?.method, opzioni?.body, opzioni?.keepalive]).toStrictEqual(['PATCH', '{"letta":true}', true]);
        expect(['Accept', 'Content-Type', 'X-XSRF-TOKEN'].map((nome) => new Headers(opzioni?.headers).get(nome))).toStrictEqual(['application/json', 'application/json', 'eyJpdiI6Ik1h==']);
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrm}/contatti/uat-persona-1`]]);
        // Con `window.location.assign` dopo l'apertura la pagina non c'è più: la richiesta deve essere già partita.
        expect(fetchFinto.mock.invocationCallOrder[1]).toBeLessThan(naviga.mock.invocationCallOrder[0] ?? 0);

        // Ogni notifica chiede la sua lettura.
        await apre(1);
        expect(richieste(fetchFinto).slice(2)).toStrictEqual(['GET /cornice/notifiche', laLettura('uat-n68')]);
        expect(naviga.mock.calls[1]).toStrictEqual([`${nelCrm}/pipeline/uat-pipeline-1/impostazioni`]);
    });

    it.each([
        ['una già letta, con la sua destinazione', dati, {}, 2, `${nelCrm}/contatti/uat-persona-2`],
        ['una non letta che nel registro non ha dove andare', dati, {}, 3, paginaDelleNotifiche],
        ['una non letta di un modulo che nel workspace non si può aprire', { ...dati, prodotti: { pm: 'attivo', crm: 'in_arrivo' } }, {}, 0, paginaDelleNotifiche],
        ['una non letta di un elenco di cui la parte server non dice il workspace', dati, { workspace: '' }, 0, paginaDelleNotifiche],
    ] satisfies [string, DatiDellaCornice, { workspace?: string }, number, string][])('%s non chiede la lettura: il clic apre soltanto, e il numero resta (sprint 22 · T2.2)', async (_quale, dellaPagina, dellElenco, indice, aperto) => {
        const fetchFinto = rotteDelClic([{ data: daAprire, ...dellElenco }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dellaPagina, non_lette: 3 }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(indice);
        expect(naviga.mock.calls).toStrictEqual([[aperto]]);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
        expect([campanella(), detto()]).toStrictEqual(['3', '']);
    });

    // Sprint 24 · T3 (voce #1748). Una scheda di Project Management — nuova, modificata, o assegnata a chi riceve la notifica —
    // si apre con un clic: la pagina della scheda in zr-board, `/c/<id>` (zr-board, nota 10451 del #95), nel workspace
    // dell'elenco, e il clic la segna letta come ogni notifica che ha una risorsa. Una scheda eliminata e gli altri tipi della
    // board restano alla pagina delle notifiche; il titolo della scheda assegnata è nella tabella dei titoli, più sotto.
    const nellaBoard = 'https://board.zeiras.com/w/acme-marketing';
    const tipiDiUnaScheda = ['board.scheda.assegnata', 'com.zeiras.board.scheda.creata', 'com.zeiras.board.scheda.modificata'];
    /** Tre non lette, una per tipo, come le dà la parte server: con chi ha fatto, il nome della scheda e il solo `id` fra gli `ids`. */
    const delleSchede = tipiDiUnaScheda.map((tipo, indice) => ({
        id: `uat-n${99 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm', tipo, autore_nome: 'Marta Rossi', risorsa_nome: `UAT Scheda ${indice + 1}`, per_me: indice === 0 ? true : null, ids: { id: `uat-scheda-${indice + 1}` },
    }));

    it.each<[string, string | undefined, { workspace?: string }, string]>([
        ['il workspace dei dati, dalla Dashboard', undefined, {}, nellaBoard],
        ['il workspace dei dati, dal CRM', 'crm', {}, nellaBoard],
        ['un altro workspace', 'pm', { workspace: 'acme-vendite' }, 'https://board.zeiras.com/w/acme-vendite'],
    ])('un clic su una notifica di una scheda nuova, modificata o assegnata apre la scheda in Project Management, `/c/<id>` nel workspace dell\'elenco — %s —, e la segna letta (sprint 24 · T3.2, T3.4)', async (_quale, prodotto, dellElenco, nelWorkspace) => {
        const fetchFinto = rotteDelClic([{ data: delleSchede, ...dellElenco }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 3 }} product={prodotto} naviga={naviga} onLogout={esciSenzaEffetto} />);

        for (let indice = 0; indice < delleSchede.length; indice++) {
            await apre(indice);
        }
        expect(naviga.mock.calls).toStrictEqual([[`${nelWorkspace}/c/uat-scheda-1`], [`${nelWorkspace}/c/uat-scheda-2`], [`${nelWorkspace}/c/uat-scheda-3`]]);
        // Una scheda ha una risorsa: ogni clic chiede la lettura della sua notifica, mai di un'altra.
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([laLettura('uat-n99'), laLettura('uat-n98'), laLettura('uat-n97')]);
        expect(naviga.mock.calls.flat().some((indirizzo) => String(indirizzo).startsWith(paginaDelleNotifiche))).toBe(false);
    });

    it.each([['it', 'Ti è stata assegnata una scheda'], ['en', 'A card was assigned to you'], ['es', 'Se te ha asignado una tarjeta']])('con la lingua "%s", nel pannello una notifica di una scheda assegnata si chiama «%s», mai col titolo di ripiego, e sotto ha il nome della scheda (sprint 24 · T3.1)', async (lingua, titolo) => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: delleSchede.slice(0, 1) }]));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        expect(titoli()).toStrictEqual([titolo]);
        expect(titolo).not.toBe(diRipiego[lingua]);
        expect(secondeRighe()).toStrictEqual(['UAT Scheda 1']);
    });

    it.each<[string, unknown]>([
        ['senza `ids`', undefined],
        ['con `ids` vuoto', {}],
        ['con la board e la lista ma non il suo id', { board_id: 'uat-board-1', lista_id: 'uat-lista-1' }],
        ['con l\'id `..`', { id: '..' }],
        ['con una barra nell\'id', { id: 'uat-scheda-1/x' }],
        ['con un id di 65 caratteri', { id: 'a'.repeat(65) }],
    ])('un clic su una notifica di una scheda %s apre la pagina delle notifiche e non la segna letta: mai un indirizzo con un id fuori forma (sprint 24 · T3.3)', async (_quale, ids) => {
        const elenco = delleSchede.map((notifica) => ({ ...notifica, ids }));
        const fetchFinto = rotteDelClic([{ data: elenco }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 3 }} product="pm" naviga={naviga} onLogout={esciSenzaEffetto} />);

        for (let indice = 0; indice < elenco.length; indice++) {
            await apre(indice);
        }
        expect(naviga.mock.calls).toStrictEqual([[paginaDelleNotifiche], [paginaDelleNotifiche], [paginaDelleNotifiche]]);
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([]);
        expect(campanella()).toBe('3');
    });

    it('un clic su una scheda eliminata, su un altro tipo della board o su un tipo scritto quasi come quelli di una scheda apre la pagina delle notifiche e non la segna letta, anche con l\'id (sprint 24 · T3.4)', async () => {
        const altri = ['com.zeiras.board.scheda.eliminata', 'com.zeiras.board.lista.creata', 'com.zeiras.board.board.modificata', 'com.zeiras.board.cartella.creata', 'com.zeiras.board.etichetta.creata', 'com.zeiras.board.vista.creata', 'com.zeiras.board.scheda.assegnata', 'board.scheda.creata'];
        const elenco = altri.map((tipo, indice) => ({ id: `uat-n${89 - indice}`, creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm', tipo, ids: { id: `uat-x-${indice + 1}`, board_id: 'uat-board-1' } }));
        const fetchFinto = rotteDelClic([{ data: elenco }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 8 }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        for (let indice = 0; indice < elenco.length; indice++) {
            await apre(indice);
        }
        expect(naviga.mock.calls).toStrictEqual(altri.map(() => [paginaDelleNotifiche]));
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([]);
    });

    // Sprint 26 · T6 (voce #1773). Chi viene menzionato in un commento riceve una notifica di Project Management che non è un
    // evento: il tipo arriva senza `com.zeiras.` davanti. Un clic apre la scheda del commento, `/c/<id>` (zr-board, nota 10846
    // del #95: la board non ha un indirizzo che porti dritto a un commento), e la segna letta. La parte server dà il solo `id`
    // della scheda; se `commento_id` arrivasse, nell'indirizzo non entrerebbe.
    const dellaMenzione = { id: 'uat-n79', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm' as string | null, tipo: 'board.commento.menzione', autore_nome: 'Bruno Neri', risorsa_nome: 'UAT Scheda 7', per_me: true, ids: { id: 'uat-scheda-7' } as Record<string, string> };

    it.each<[string, Record<string, string>]>([
        ['col solo `id` della scheda, come la dà la parte server', { id: 'uat-scheda-7' }],
        ['anche se fra gli `ids` arrivasse `commento_id`', { id: 'uat-scheda-7', commento_id: 'uat-commento-9' }],
    ])('un clic su una notifica di una menzione in un commento apre la scheda in Project Management, `/c/<id>` con l\'id della scheda, e la segna letta — %s (sprint 26 · T6.2)', async (_quale, ids) => {
        const fetchFinto = rotteDelClic([{ data: [{ ...dellaMenzione, ids }] }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 1 }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(naviga.mock.calls).toStrictEqual([[`${nellaBoard}/c/uat-scheda-7`]]);
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([laLettura('uat-n79')]);
    });

    it.each([['it', 'Ti hanno menzionato in un commento'], ['en', 'You were mentioned in a comment'], ['es', 'Te han mencionado en un comentario']])('con la lingua "%s", nel pannello una notifica di una menzione in un commento si chiama «%s», mai col titolo di ripiego, e sotto ha il nome della scheda (sprint 26 · T6.1)', async (lingua, titolo) => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: [dellaMenzione] }]));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 1 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));

        expect(titoli()).toStrictEqual([titolo]);
        expect(titolo).not.toBe(diRipiego[lingua]);
        expect(secondeRighe()).toStrictEqual(['UAT Scheda 7']);
    });

    it('un clic su una menzione col tipo scritto quasi giusto — `com.zeiras.` davanti, un pezzo in meno, uno in più —, con `app` `crm` o senza `app`, apre la pagina delle notifiche e non la segna letta (sprint 26 · T6.2)', async () => {
        const quasi: [app: string | null, tipo: string][] = [['pm', 'com.zeiras.board.commento.menzione'], ['pm', 'board.commento'], ['pm', 'board.commento.menzione.poi'], ['crm', 'board.commento.menzione'], [null, 'board.commento.menzione']];
        const elenco = quasi.map(([app, tipo], indice) => ({ ...dellaMenzione, id: `uat-n${69 - indice}`, app, tipo }));
        const fetchFinto = rotteDelClic([{ data: elenco }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, non_lette: 5 }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        for (let indice = 0; indice < elenco.length; indice++) {
            await apre(indice);
        }
        expect(naviga.mock.calls).toStrictEqual(quasi.map(() => [paginaDelleNotifiche]));
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([]);
    });

    it('in un workspace dove Project Management non si può aprire un clic su una scheda assegnata apre la pagina delle notifiche, mai la scheda, e non la segna letta (sprint 24 · T3.2)', async () => {
        const fetchFinto = rotteDelClic([{ data: delleSchede }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={{ ...dati, prodotti: { pm: 'in_arrivo', crm: 'attivo' }, non_lette: 3 }} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(naviga.mock.calls).toStrictEqual([[paginaDelleNotifiche]]);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
    });

    it.each([
        ['la rete cade', async () => { throw new TypeError('uat: la rete è caduta'); }],
        ['la notifica non c\'è più (404)', async () => risposta({ errore: 'non_trovato' }, 404)],
        ['la parte server non risponde (503)', async () => risposta({}, 503)],
        ['la risposta dice che è rimasta non letta', async (id: string) => risposta({ data: { id, letta: false }, segnata_il: '2026-10-06T12:00:08.123456Z' })],
        ['la risposta dice `letta` con un testo', async (id: string) => risposta({ data: { id, letta: 'true' }, segnata_il: '2026-10-06T12:00:08.123456Z' })],
        ['la risposta non ha `data`', async () => risposta({ segnata_il: '2026-10-06T12:00:08.123456Z' })],
        ['la risposta non è un oggetto', async () => risposta(null)],
        ['la risposta non è JSON', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('uat: non è JSON'); } }) as unknown as Response],
    ] satisfies [string, (id: string) => Promise<Response>][])('se la lettura fallisce — %s — la risorsa si è aperta lo stesso e in pagina non cambia niente: né il numero, né la notifica, né l\'avviso, e nessun errore resta non gestito (sprint 22 · T2.3)', async (_come, allaLettura) => {
        const fetchFinto = rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }], allaLettura);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={letti(alSecondo(3), 3)} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', laLettura('uat-n69')]);
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrm}/contatti/uat-persona-1`]]);
        expect([campanella(), detto()]).toStrictEqual(['3', '']);

        // Riaperto il pannello, con l'elenco che la parte server dà ancora: quella notifica è ancora da leggere.
        await clic(uno('.zr-bell'));
        expect(nonLette()).toStrictEqual([true, true, false, true]);
        expect([campanella(), detto()]).toStrictEqual(['3', '']);
    });

    it('la risorsa si apre senza aspettare la lettura; quando la parte server risponde `letta: true` il numero scende di uno — non al clic, e una volta sola — e la notifica è letta nel pannello; coi dati letti dopo la lettura vale il loro numero (sprint 22 · T2.3, T2.4)', async () => {
        const lettura = inAttesa();
        // L'elenco è letto al secondo 5, e riletto uguale — con quella notifica ancora da leggere — al 7 e al 9: la lettura è dell'8.
        const fetchFinto = rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }, { data: daAprire, lettoIl: alSecondo(7) }, { data: daAprire, lettoIl: alSecondo(9) }], () => lettura.promessa);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="crm" naviga={naviga} onLogout={esciSenzaEffetto} />;
        await mostra(pagina(letti(alSecondo(3), 3)));

        await apre(0);
        // La risorsa è già aperta, e la parte server non ha ancora risposto: il numero aspetta lei.
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrm}/contatti/uat-persona-1`]]);
        expect(campanella()).toBe('3');

        await lettura.arriva(segnata('uat-n69', alSecondo(8)));
        expect(campanella()).toBe('2');
        expect(naviga).toHaveBeenCalledTimes(1);

        // I dati del clic ridati in un altro oggetto, con lo stesso segno: è la stessa lettura, di prima del clic, e la contano
        // ancora. Il numero resta sceso.
        await mostra(pagina(letti(alSecondo(3), 3)));
        expect(campanella()).toBe('2');

        // Un elenco letto prima che la lettura fosse segnata la dà ancora da leggere: nel pannello è letta lo stesso.
        await clic(uno('.zr-bell'));
        expect(nonLette()).toStrictEqual([false, true, false, true]);
        expect(campanella()).toBe('2');

        // Un elenco letto dopo vale per ciò che dice: lì è tornata da leggere (un'altra scheda), e si conta.
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-bell'));
        expect(nonLette()).toStrictEqual([true, true, false, true]);
        expect(campanella()).toBe('3');

        // Dati letti dopo la lettura la contano già letta: vale il loro numero, e non scende una seconda volta.
        await mostra(pagina(letti(alSecondo(10), 2)));
        expect(campanella()).toBe('2');
        expect(richieste(fetchFinto).filter((richiesta) => richiesta.startsWith('PATCH'))).toStrictEqual([laLettura('uat-n69')]);
    });

    // Review della PR #44, R1. Il segno dei dati è preso prima della loro lettura dal backoffice, `segnata_il` dopo la risposta
    // alla lettura: dei dati chiesti mentre la lettura era in volo — la visita che parte col clic — hanno il segno fra quello
    // dei dati del clic e `segnata_il`, e possono contare la notifica già letta come ancora da leggere. Non si può sapere, e
    // non si toglie niente: vale il loro numero, al più uno in più fino alla visita dopo, mai uno in meno.
    it.each([
        ['la contano già letta: la campanella non scende una seconda volta, e l\'avviso dice ancora il vero', 2, '2', 'Notifiche, 2 non lette'],
        ['la contano ancora: una in più fino alla visita dopo, e l\'avviso non resta a dire il numero di prima', 3, '3', ''],
    ])('dei dati letti dopo il clic e prima di `segnata_il` %s (review della PR #44, R1)', async (_come, contate, sullaCampanella, dalLettore) => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }], (id) => segnata(id, alSecondo(8))));
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />;
        await mostra(pagina(letti(alSecondo(3), 3)));

        await apre(0);
        expect([campanella(), detto()]).toStrictEqual(['2', 'Notifiche, 2 non lette']);

        await mostra(pagina(letti(alSecondo(6), contate)));
        expect([campanella(), detto()]).toStrictEqual([sullaCampanella, dalLettore]);
    });

    it('i dati della visita arrivano prima della risposta della lettura e la contano già letta: alla risposta il numero non scende un\'altra volta, e l\'avviso tace (review della PR #44, R1)', async () => {
        const lettura = inAttesa();
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }], () => lettura.promessa));
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />;
        await mostra(pagina(letti(alSecondo(3), 3)));

        await apre(0);
        expect(campanella()).toBe('3');
        await mostra(pagina(letti(alSecondo(6), 2)));
        expect(campanella()).toBe('2');

        await lettura.arriva(segnata('uat-n69', alSecondo(8)));
        expect([campanella(), detto()]).toStrictEqual(['2', '']);
    });

    // Sprint 23 · T2 (voce #1742, S1). L'elenco del clic può essere più vecchio dei dati del clic: il pannello è rimasto aperto
    // mentre i dati cambiavano. Se nel mezzo la notifica è stata letta altrove, quei dati la contano già letta, e la lettura
    // non toglie niente dal loro numero: vale il numero dei dati, al più una in più fino alla visita dopo, mai una in meno.
    it('se l\'elenco del clic è più vecchio dei dati del clic — la notifica letta altrove nel mezzo, e i dati la contano già letta — il clic apre la risorsa e il numero non scende: resta quello dei dati del clic; e l\'avviso tace (sprint 23 · T2.1; sprint 24 · T4.5)', async () => {
        const fetchFinto = rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }], (id) => segnata(id, alSecondo(9)));
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={naviga} onLogout={esciSenzaEffetto} />;
        await mostra(pagina(letti(alSecondo(3), 3)));
        await clic(uno('.zr-bell'));

        // A pannello aperto arrivano dati letti al secondo 7: la prima notifica è stata letta da un'altra scheda al 6, e ne
        // contano 2. Nell'elenco in pagina, letto al 5, è ancora da leggere.
        await mostra(pagina(letti(alSecondo(7), 2)));
        const prima = [campanella(), nonLette()[0]];

        await clic(voci()[0] ?? null);
        // Un'asserzione sola, con ciò che c'era prima del clic: sul codice della `v1.12.0` è rossa, perché lì il numero scende
        // a 1. Coi dati letti dopo il clic vale il loro numero anche lì: lo provano i casi più sopra, non questo.
        expect({ prima, aperta: naviga.mock.calls, partite: richieste(fetchFinto), dopo: [campanella(), detto()] }).toStrictEqual({
            prima: ['2', true],
            aperta: [[`${nelCrm}/contatti/uat-persona-1`]],
            partite: ['GET /cornice/notifiche', laLettura('uat-n69')],
            // Coi dati del clic: la contavano già letta.
            dopo: ['2', ''],
        });
    });

    // Review della PR #44, R6. L'id di una notifica arriva dal backoffice, e la parte server controlla solo che sia un testo:
    // con `.` o `..` il browser manderebbe la `PATCH`, col gettone CSRF, a un'altra rotta. La lettura non parte, e il resto
    // del clic non cambia.
    it.each(['.', '..'])('un clic su una notifica non letta il cui id è «%s» apre la sua risorsa, e la lettura non parte: il numero resta com\'è (review della PR #44, R6)', async (id) => {
        const fetchFinto = rotteDelClic([{ data: [{ ...delContatto, id }, dellaPipeline, dellaNota, dellaScheda], lettoIl: alSecondo(5) }]);
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={letti(alSecondo(3), 3)} product="crm" naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrm}/contatti/uat-persona-1`]]);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche']);
        expect([campanella(), detto()]).toStrictEqual(['3', '']);
    });

    it('senza gli istanti della parte server — una di prima della v1.12.0, dati senza segno — il numero scende per i dati con cui la lettura è partita, e con dati nuovi vale il loro numero (sprint 22 · T2.4)', async () => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire }]));
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />;
        const senzaSegno = { ...dati, non_lette: 3 };
        await mostra(pagina(senzaSegno));

        await apre(0);
        expect([campanella(), detto()]).toStrictEqual(['2', 'Notifiche, 2 non lette']);
        // Gli stessi dati, ridati dalla pagina: resta sceso.
        await mostra(pagina(senzaSegno));
        expect(campanella()).toBe('2');
        // Dati nuovi: senza istanti non si sa se contano già la lettura, e vale il loro numero.
        await mostra(pagina({ ...dati, non_lette: 3 }));
        expect(campanella()).toBe('3');
    });

    it('due clic su due notifiche: il numero scende due volte, e l\'avviso dice ogni volta il numero nuovo (sprint 22 · T2.4, T2.6)', async () => {
        const istanti = [alSecondo(8), alSecondo(12)];
        // Il secondo elenco è letto dopo la prima lettura, e la dà letta.
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }, { data: [{ ...delContatto, letta: true }, dellaPipeline, dellaNota, dellaScheda], lettoIl: alSecondo(10) }], (id) => segnata(id, istanti.shift())));
        await mostra(<Cornice dati={letti(alSecondo(3), 3)} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect([campanella(), detto()]).toStrictEqual(['2', 'Notifiche, 2 non lette']);
        await apre(1);
        expect([campanella(), detto()]).toStrictEqual(['1', 'Notifiche, 1 non letta']);
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe('Notifiche, 1 non letta');
    });

    it('la stessa notifica aperta due volte — fra l\'una e l\'altra è tornata da leggere — si toglie dal numero una volta sola (sprint 22 · T2.4)', async () => {
        const istanti = [alSecondo(8), alSecondo(12)];
        // I dati contano tre non lette: due stanno oltre la prima pagina. Il secondo elenco è letto dopo la prima lettura.
        const elenco = [delContatto, dellaNota];
        vi.stubGlobal('fetch', rotteDelClic([{ data: elenco, lettoIl: alSecondo(5) }, { data: elenco, lettoIl: alSecondo(9) }], (id) => segnata(id, istanti.shift())));
        await mostra(<Cornice dati={letti(alSecondo(3), 3)} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(campanella()).toBe('2');
        await apre(0);
        expect(campanella()).toBe('2');
    });

    it.each([
        ['i dati non contano non lette, e l\'elenco ne ha una arrivata dopo', letti('2026-10-06T12:00:03.123456Z', 0), '1'],
        ['i dati, più recenti dell\'elenco, non contano non lette', letti('2026-10-06T12:00:06.123456Z', 0), null],
    ] satisfies [string, DatiDellaCornice, string | null][])('il numero non scende sotto zero: %s (sprint 22 · T2.4)', async (_quando, dellaPagina, prima) => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: [delContatto, dellaNota], lettoIl: alSecondo(5) }], (id) => segnata(id, alSecondo(8))));
        await mostra(<Cornice dati={dellaPagina} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(campanella()).toBe(prima);
        await clic(voci()[0] ?? null);
        expect(campanella()).toBeNull();
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe('Notifiche');
    });

    it('senza il numero nei dati le non lette le conta il design system dall\'elenco: alla risposta della lettura scendono di una (sprint 22 · T2.4)', async () => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire }]));
        await mostra(<Cornice dati={dati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('3');
        await clic(voci()[0] ?? null);
        expect([campanella(), detto()]).toStrictEqual(['2', 'Notifiche, 2 non lette']);
    });

    it('con l\'elenco di un altro workspace la lettura parte lo stesso e la risorsa si apre lì, ma il numero dei dati della pagina non scende, e l\'avviso tace: quella notifica non è fra le sue (sprint 22 · T2.4)', async () => {
        const fetchFinto = rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5), workspace: 'acme-vendite' }], (id) => segnata(id, alSecondo(8)));
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={letti(alSecondo(3), 3)} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await apre(0);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', laLettura('uat-n69')]);
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrmDellAltro}/contatti/uat-persona-1`]]);
        expect([campanella(), detto()]).toStrictEqual(['3', '']);
    });

    // Sprint 22 · T6 (voce #1726; review della PR #44, R4): le non lette di un elenco contano sulla campanella solo se l'elenco è
    // del workspace dei dati della pagina, o se la parte server non dice di quale workspace è. Con due schede su due workspace
    // la scheda rimasta indietro riceve l'elenco dell'altro: sulla sua campanella resta il numero dei suoi dati. Il caso qui
    // sopra non lo vede: lì il numero dei dati è uguale alle non lette dell'elenco.

    // Sprint 23 · T2 (voce #1742, S5): il README della `v1.12.0` lo dice, e nessun caso lo fissava con l'elenco di un altro workspace.
    it('senza il numero nei dati, con l\'elenco di un altro workspace la campanella conta le non lette che il pannello ha caricato: non c\'è un numero della pagina da tenere (sprint 23 · T2.5)', async () => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire, workspace: 'acme-vendite' }]));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        expect(campanella()).toBeNull();

        await clic(uno('.zr-bell'));
        expect([voci().length, campanella()]).toStrictEqual([4, '3']);
    });

    it('con l\'elenco di un altro workspace che ha più non lette del numero dei dati la campanella resta al numero dei dati: quando l\'elenco arriva, e dopo un clic che apre la risorsa lì e fa partire la lettura; nel pannello la notifica è letta, e l\'avviso tace (sprint 22 · T6.1, T6.2)', async () => {
        const fetchFinto = rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5), workspace: 'acme-vendite' }], (id) => segnata(id, alSecondo(8)));
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={letti(alSecondo(3), 1)} naviga={naviga} onLogout={esciSenzaEffetto} />);

        // L'elenco è più recente dei dati e ha tre non lette: sono dell'altro workspace, non della pagina.
        await clic(uno('.zr-bell'));
        expect([campanella(), nonLette()]).toStrictEqual(['1', [true, true, false, true]]);

        await clic(voci()[0] ?? null);
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', laLettura('uat-n69')]);
        expect(naviga.mock.calls).toStrictEqual([[`${nelCrmDellAltro}/contatti/uat-persona-1`]]);
        expect([campanella(), detto()]).toStrictEqual(['1', '']);

        // Il pannello riaperto ricarica lo stesso elenco, letto prima della lettura: la notifica del clic è letta, e il numero
        // resta quello dei dati.
        await clic(uno('.zr-bell'));
        expect([campanella(), nonLette(), detto()]).toStrictEqual(['1', [false, true, false, true], '']);
    });

    it.each<[string, string | undefined, string[], string[]]>([
        ['del workspace dei dati', 'acme-marketing', ['GET /cornice/notifiche', 'PATCH /cornice/notifiche/uat-n69/lettura'], ['2', 'Notifiche, 2 non lette']],
        // Una parte server di prima della `v1.12.0`, o una finta nei test di un frontend: il clic apre la pagina delle notifiche.
        ['di una parte server che non dice il workspace', undefined, ['GET /cornice/notifiche'], ['3', '']],
    ])('con l\'elenco %s le sue non lette contano come prima: la campanella non dice meno delle non lette dell\'ultimo elenco, e scende col clic che segna letta una notifica (sprint 22 · T6.3)', async (_caso, workspace, partite, dopoIlClic) => {
        const fetchFinto = vi.fn(async (indirizzo: string, _opzioni?: RequestInit) => (indirizzo === '/cornice/notifiche'
            ? risposta({ data: daAprire, aggiornati_il: alSecondo(5), ...(workspace === undefined ? {} : { workspace }) })
            : segnata('uat-n69', alSecondo(8))));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={letti(alSecondo(3), 1)} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(campanella()).toBe('3');

        await clic(voci()[0] ?? null);
        expect(richieste(fetchFinto)).toStrictEqual(partite);
        expect([campanella(), detto()]).toStrictEqual(dopoIlClic);
    });

    it.each([
        ['it', [delContatto, dellaPipeline, dellaScheda], 'Notifiche, 2 non lette', 'Notifiche, 2 non lette'],
        ['it', [delContatto, dellaPipeline], 'Notifiche, 1 non letta', 'Notifiche, 1 non letta'],
        ['it', [delContatto, dellaNota], 'Nessuna notifica non letta', 'Notifiche'],
        ['en', [delContatto, dellaPipeline, dellaScheda], 'Notifications, 2 unread', 'Notifications, 2 unread'],
        ['en', [delContatto, dellaPipeline], 'Notifications, 1 unread', 'Notifications, 1 unread'],
        ['en', [delContatto, dellaNota], 'No unread notifications', 'Notifications'],
        ['es', [delContatto, dellaPipeline, dellaScheda], 'Notificaciones, 2 sin leer', 'Notificaciones, 2 sin leer'],
        ['es', [delContatto, dellaPipeline], 'Notificaciones, 1 sin leer', 'Notificaciones, 1 sin leer'],
        ['es', [delContatto, dellaNota], 'Ninguna notificación sin leer', 'Notificaciones'],
        // Una lingua che zr-core non ha: in inglese, come ogni altro testo.
        ['pt-BR', [delContatto, dellaNota], 'No unread notifications', 'Notifications'],
    ])('in "%s" la cornice ha un avviso che non si vede, vuoto finché il numero non scende per un clic; allora dice il nome della campanella col numero nuovo, e a zero il testo di zr-core — «%s» (sprint 22 · T2.6)', async (lingua, elenco, daDire, dellaCampanella) => {
        const lettura = inAttesa();
        vi.stubGlobal('fetch', rotteDelClic([{ data: elenco, lettoIl: alSecondo(5) }], () => lettura.promessa));
        await mostra(<Cornice dati={letti(alSecondo(3), elenco.filter((notifica) => !notifica.letta).length, { lingua })} naviga={vi.fn()} onLogout={esciSenzaEffetto} />);

        // Al caricamento c'è già, fuori dall'`AppShell`, con la classe del design system per ciò che non si vede: ed è vuoto.
        expect([avviso()?.tagName, avviso()?.className, detto()]).toStrictEqual(['DIV', 'zr-visually-hidden', '']);
        expect(avviso()?.closest('.zr-shell')).toBeNull();
        expect(tutti('[role="status"]')).toHaveLength(1);

        // Vuoto anche con l'elenco arrivato, e con la lettura in volo.
        await apre(0);
        expect(detto()).toBe('');

        await lettura.arriva(segnata('uat-n69', alSecondo(8)));
        expect(detto()).toBe(daDire);
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe(dellaCampanella);
    });

    it('l\'avviso parla solo per il numero che scende con un clic: quando il numero cambia coi dati nuovi, o con un elenco arrivato, non lo dice, e ciò che aveva detto non resta lì a dire un numero che non è più quello (sprint 22 · T2.6)', async () => {
        vi.stubGlobal('fetch', rotteDelClic([{ data: daAprire, lettoIl: alSecondo(5) }], (id) => segnata(id, alSecondo(8))));
        const pagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />;
        await mostra(pagina(letti(alSecondo(3), 1)));

        // Il numero sale con l'elenco, più recente dei dati; poi cambia coi dati nuovi. L'avviso tace. I dati nuovi sono letti
        // prima dell'elenco (al secondo 4, l'elenco al 5): dallo sprint 23, con dati più recenti dell'elenco il clic non toglie
        // niente dal numero (T2.1), e qui il numero deve scendere.
        await clic(uno('.zr-bell'));
        expect([campanella(), detto()]).toStrictEqual(['3', '']);
        await mostra(pagina(letti(alSecondo(4), 5)));
        expect([campanella(), detto()]).toStrictEqual(['5', '']);

        await clic(voci()[0] ?? null);
        expect([campanella(), detto()]).toStrictEqual(['4', 'Notifiche, 4 non lette']);
        // Dati letti dopo la lettura, con lo stesso numero: l'avviso dice ancora il vero, e resta.
        await mostra(pagina(letti(alSecondo(9), 4)));
        expect([campanella(), detto()]).toStrictEqual(['4', 'Notifiche, 4 non lette']);
        // Con un altro numero: non lo dice, e non resta a dire quello di prima.
        await mostra(pagina(letti(alSecondo(10), 6)));
        expect([campanella(), detto()]).toStrictEqual(['6', '']);
    });

    /**
     * I titoli dei 42 tipi di notifica che zr-core conosce, in italiano, inglese e spagnolo: la tabella dello sprint 12 e, dallo
     * sprint 21, i sette del CRM (voce #1641: nel CRM una `persona` è un «contatto») e i cinque che il contratto porta dall'11/10
     * (voce #1706: le viste salvate di una board, e le aziende del CRM, che nel contratto sono `organizzazione`); dallo sprint 22
     * i nove in fondo (voce #1720: le opportunità, che nel contratto sono `trattativa`, le attività, e i quattro «assegnata», che
     * non sono eventi e arrivano senza `com.zeiras.` davanti); dallo sprint 24 la scheda assegnata (voce #1748: di
     * Project Management, non è un evento nemmeno lei); dallo sprint 26 l'ultimo (voce #1773: la menzione in un commento, come lei).
     * Scritta qui e non letta dai file delle lingue.
     */
    const titoliPerTipo: [tipo: string, it: string, en: string, es: string][] = [
        ['com.zeiras.app.modificata', 'Un modulo è stato attivato o disattivato', 'A module was turned on or off', 'Se activó o desactivó un módulo'],
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
        ['com.zeiras.board.vista.creata', 'Nuova vista', 'New view', 'Nueva vista'],
        ['com.zeiras.board.vista.modificata', 'Vista modificata', 'View changed', 'Vista modificada'],
        ['com.zeiras.board.vista.eliminata', 'Vista eliminata', 'View deleted', 'Vista eliminada'],
        ['com.zeiras.crm.persona.creata', 'Nuovo contatto', 'New contact', 'Nuevo contacto'],
        ['com.zeiras.crm.persona.modificata', 'Contatto modificato', 'Contact changed', 'Contacto modificado'],
        ['com.zeiras.crm.pipeline.creata', 'Nuova pipeline', 'New pipeline', 'Nueva pipeline'],
        ['com.zeiras.crm.pipeline.modificata', 'Pipeline modificata', 'Pipeline changed', 'Pipeline modificada'],
        ['com.zeiras.crm.nota.creata', 'Nuova nota', 'New note', 'Nueva nota'],
        ['com.zeiras.crm.nota.modificata', 'Nota modificata', 'Note changed', 'Nota modificada'],
        ['com.zeiras.crm.nota.eliminata', 'Nota eliminata', 'Note deleted', 'Nota eliminada'],
        ['com.zeiras.crm.organizzazione.creata', 'Nuova azienda', 'New company', 'Nueva empresa'],
        ['com.zeiras.crm.organizzazione.modificata', 'Azienda modificata', 'Company changed', 'Empresa modificada'],
        ['com.zeiras.crm.trattativa.creata', 'Nuova opportunità', 'New opportunity', 'Nueva oportunidad'],
        ['com.zeiras.crm.trattativa.modificata', 'Opportunità modificata', 'Opportunity changed', 'Oportunidad modificada'],
        ['com.zeiras.crm.attivita.creata', 'Nuova attività', 'New activity', 'Nueva actividad'],
        ['com.zeiras.crm.attivita.modificata', 'Attività modificata', 'Activity changed', 'Actividad modificada'],
        ['com.zeiras.crm.attivita.eliminata', 'Attività eliminata', 'Activity deleted', 'Actividad eliminada'],
        ['crm.persona.assegnata', 'Ti è stato assegnato un contatto', 'A contact was assigned to you', 'Se te ha asignado un contacto'],
        ['crm.organizzazione.assegnata', 'Ti è stata assegnata un\'azienda', 'A company was assigned to you', 'Se te ha asignado una empresa'],
        ['crm.trattativa.assegnata', 'Ti è stata assegnata un\'opportunità', 'An opportunity was assigned to you', 'Se te ha asignado una oportunidad'],
        ['crm.attivita.assegnata', 'Ti è stata assegnata un\'attività', 'An activity was assigned to you', 'Se te ha asignado una actividad'],
        ['board.scheda.assegnata', 'Ti è stata assegnata una scheda', 'A card was assigned to you', 'Se te ha asignado una tarjeta'],
        ['board.commento.menzione', 'Ti hanno menzionato in un commento', 'You were mentioned in a comment', 'Te han mencionado en un comentario'],
    ];
    /** Il titolo di ripiego, per lingua. */
    const diRipiego: Record<string, string> = { it: 'Novità nel workspace', en: 'News in the workspace', es: 'Novedades en el workspace' };
    const titoli = () => voci().map((voce) => voce.querySelector('.zr-notif-title')?.textContent);

    it('la tabella dei titoli ha 42 tipi, tutti diversi (sprint 12 · T3.1; sprint 21 · T2.1, T5.3; sprint 22 · T5.4; sprint 24 · T3.1; sprint 26 · T6.1)', () => {
        expect(new Set(titoliPerTipo.map(([tipo]) => tipo)).size).toBe(42);
        expect(titoliPerTipo).toHaveLength(42);
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

    // Sprint 21 · T2 (voce #1641): le notifiche del CRM arrivano con `app: 'crm'`, e davanti all'ora c'è il nome del modulo.
    it.each([['it', '5 minuti fa'], ['en', '5 minutes ago'], ['es', 'hace 5 minutos']])('con la lingua "%s", le nove notifiche del CRM, comprese le due delle aziende, hanno nel pannello il titolo del loro tipo e «CRM» davanti all\'ora; un tipo del CRM che zr-core non conosce ancora ha il titolo di ripiego, con «CRM» (sprint 21 · T2.1, T2.2, T5.1)', async (lingua, pocoFa) => {
        // Contatti, pipeline, note e aziende: opportunità, attività e «assegnata» hanno il loro caso, qui sotto (sprint 22 · T5.1).
        const delCrm = titoliPerTipo.filter(([tipo]) => /^com\.zeiras\.crm\.(persona|pipeline|nota|organizzazione)\./.test(tipo));
        const elenco = [
            ...delCrm.map(([tipo], indice) => ({ ...nata(`uat-n${80 - indice}`, '2026-10-06T11:55:00Z'), tipo, app: 'crm' })),
            { ...nata('uat-n70', '2026-10-06T11:55:00Z'), tipo: 'com.zeiras.crm.persona.assegnata', app: 'crm' },
        ];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 10 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(delCrm).toHaveLength(9);
        // Le due delle aziende sono fra le nove, col titolo che dà il CRM.
        expect(titoli().slice(7, 9)).toStrictEqual({ it: ['Nuova azienda', 'Azienda modificata'], en: ['New company', 'Company changed'], es: ['Nueva empresa', 'Empresa modificada'] }[lingua]);
        expect(titoli()).toStrictEqual([...delCrm.map((riga) => riga[['', 'it', 'en', 'es'].indexOf(lingua)]), diRipiego[lingua]]);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(Array(10).fill(`CRM · ${pocoFa}`));
    });

    // Sprint 22 · T5 (voce #1720): i nove tipi nuovi del CRM arrivano con `app: 'crm'`. I cinque eventi hanno `com.zeiras.` davanti;
    // i quattro «assegnata» no: il loro `tipo` è com'è nel backoffice, e lo stesso nome col prefisso resta un tipo che zr-core non
    // conosce.
    it.each([['it', '5 minuti fa'], ['en', '5 minutes ago'], ['es', 'hace 5 minutos']])('con la lingua "%s", le nove notifiche nuove del CRM, opportunità, attività e ciò che viene assegnato, hanno nel pannello il titolo del loro tipo e «CRM» davanti all\'ora; un «assegnata» con `com.zeiras.` davanti ha il titolo di ripiego (sprint 22 · T5.1, T5.2)', async (lingua, pocoFa) => {
        // Le nove del CRM: dopo, dallo sprint 24, la tabella ha la scheda assegnata di Project Management.
        const nuove = titoliPerTipo.slice(31, 40);
        const elenco = [
            ...nuove.map(([tipo], indice) => ({ ...nata(`uat-n${80 - indice}`, '2026-10-06T11:55:00Z'), tipo, app: 'crm' })),
            { ...nata('uat-n70', '2026-10-06T11:55:00Z'), tipo: 'com.zeiras.crm.persona.assegnata', app: 'crm' },
        ];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 10 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(nuove.map(([tipo]) => tipo)).toStrictEqual([
            'com.zeiras.crm.trattativa.creata', 'com.zeiras.crm.trattativa.modificata',
            'com.zeiras.crm.attivita.creata', 'com.zeiras.crm.attivita.modificata', 'com.zeiras.crm.attivita.eliminata',
            'crm.persona.assegnata', 'crm.organizzazione.assegnata', 'crm.trattativa.assegnata', 'crm.attivita.assegnata',
        ]);
        expect(titoli()).toStrictEqual([...nuove.map((riga) => riga[['', 'it', 'en', 'es'].indexOf(lingua)]), diRipiego[lingua]]);
        expect(titoli().slice(0, 9)).not.toContain(diRipiego[lingua]);
        // La parola è quella del CRM: un'opportunità non è una «trattativa», un «deal» o una «negociación».
        expect(titoli().join(' · ')).not.toMatch(/trattativ|\bdeals?\b|negociaci/i);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(Array(10).fill(`CRM · ${pocoFa}`));
    });

    // Sprint 21 · T5 (voce #1706): le viste salvate sono di Project Management, e arrivano con `app: 'pm'`.
    it.each([['it', '5 minuti fa', 'Project Management'], ['en', '5 minutes ago', 'Project Management'], ['es', 'hace 5 minutos', 'Gestión de proyectos']])('con la lingua "%s", le tre notifiche delle viste di una board hanno nel pannello il titolo del loro tipo e il nome di Project Management davanti all\'ora (sprint 21 · T5.1)', async (lingua, pocoFa, nomeDelModulo) => {
        const delleViste = titoliPerTipo.filter(([tipo]) => tipo.startsWith('com.zeiras.board.vista.'));
        const elenco = delleViste.map(([tipo], indice) => ({ ...nata(`uat-n${80 - indice}`, '2026-10-06T11:55:00Z'), tipo, app: 'pm' }));
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 3 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(delleViste).toHaveLength(3);
        expect(titoli()).toStrictEqual(delleViste.map((riga) => riga[['', 'it', 'en', 'es'].indexOf(lingua)]));
        expect(titoli()).not.toContain(diRipiego[lingua]);
        expect(voci().map((voce) => voce.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(Array(3).fill(`${nomeDelModulo} · ${pocoFa}`));
    });

    // Sprint 16 · T5 (voce #1479): fuori dalla cornice il titolo di un tipo lo dà `titoloDellaNotifica`, dall'ingresso del
    // pacchetto, ed è la funzione del pannello: tipo per tipo, i due testi sono uno solo.
    it.each(['it', 'es', 'en', 'pt-BR'])('con la lingua "%s", titoloDellaNotifica dà a ogni tipo lo stesso titolo che il pannello mostra a una notifica di quel tipo: quello dei 42 che zr-core conosce, e quello di ripiego agli altri (sprint 16 · T5.1; sprint 22 · T5.4; sprint 24 · T3.1; sprint 26 · T6.1)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        // I 42 tipi della tabella, poi ciò che zr-core non conosce: un tipo nuovo, un nome che ogni oggetto ha, il vuoto, ciò che
        // non è un testo; in fondo all'elenco, una notifica senza `tipo`.
        const tipi: unknown[] = [...titoliPerTipo.map(([tipo]) => tipo), 'com.zeiras.crm.contatto.creato', 'constructor', '', null, 7, ['com.zeiras.board.scheda.creata']];
        const elenco = [...tipi.map((tipo, indice) => ({ ...nata(`uat-n${190 - indice}`, '2026-10-06T11:55:00Z'), tipo })), nata('uat-n50', '2026-10-06T11:50:00Z')];
        vi.stubGlobal('fetch', rotte(elenco));
        await mostra(<Cornice dati={{ ...dati, lingua, non_lette: 3 }} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        const dellaFunzione = [...tipi.map((tipo) => titoloDellaNotifica(tipo, lingua)), titoloDellaNotifica(undefined, lingua)];
        expect(titoli()).toStrictEqual(dellaFunzione);
        // Non sono due elenchi di ripieghi: i primi 42 sono i titoli della tabella nella lingua (in inglese, se zr-core non la
        // ha), e gli altri sette il ripiego.
        const deiTesti = lingua in diRipiego ? lingua : 'en';
        expect(dellaFunzione.slice(0, 42)).toStrictEqual(titoliPerTipo.map((riga) => riga[['', 'it', 'en', 'es'].indexOf(deiTesti)]));
        expect(dellaFunzione.slice(42)).toStrictEqual(Array.from({ length: 7 }, () => diRipiego[deiTesti]));
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

    it('dopo una lettura con altre: true, se l\'elenco ricaricato è di un altro workspace il pulsante non c\'è nemmeno come «Segna le altre»: è lo stesso pulsante (sprint 23 · T1.1)', async () => {
        const fetchFinto = rotteConLetture([notificheDelServer, Promise.resolve(risposta({ data: dopoUnaParte, workspace: 'acme-vendite' }))], [letturaFatta(true)]);
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 60 }} onLogout={esciSenzaEffetto} />);
        await clic(uno('.zr-bell'));
        await clic(segnaTutte());

        // L'elenco ricaricato è in pagina e la campanella ha il numero dei dati: ne restano, ma da qui non si segnano.
        expect([voci().length, campanella()]).toStrictEqual([dopoUnaParte.length, '60']);
        expect(segnaTutte()).toBeNull();
        expect(richieste(fetchFinto)).toStrictEqual(['GET /cornice/notifiche', 'POST /cornice/notifiche/letture', 'GET /cornice/notifiche']);
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
// della richiesta, mai nel suo indirizzo. Sprint 25 · T4 (voce #1639): un risultato porta anche `contesto`, come in ricerca.crea,
// e la ricerca mostra anche schede, contatti, aziende e opportunità, con la seconda riga.
describe('la ricerca', () => {
    /**
     * I risultati come li dà POST /cornice/ricerca, nell'ordine del backoffice (per titolo): i tipi mescolati (l'`AppShell` apre
     * un gruppo a ogni cambio di gruppo), lo stesso id in due tipi, due tipi che il registro non ha (uno mai visto, e uno che
     * somiglia a quello delle schede, `board.scheda`, senza esserlo) e un risultato con un `app` che non è il suo prodotto: non conta.
     */
    const risultatiDelServer = [
        { tipo: 'board.board', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Lancio Q4' },
        { tipo: 'board.cartelle', id: '01k6w2d5f7h9k1n3q5s7v9x1z3', titolo: 'Marketing' },
        { tipo: 'uat-ignoto', id: '9', titolo: 'Piano di un tipo ignoto' },
        { app: 'crm', tipo: 'board.board', id: 'uat-13', titolo: 'Report marketing' },
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
    /** La risposta della ricerca coi suoi risultati e il workspace di cui sono: quello dei dati, se non se ne dice un altro. */
    const trovati = (risultati: unknown[], workspace: string = dati.workspace.slug) => risposta({ data: risultati, workspace });
    const vecchi = [{ tipo: 'board.board', id: '1', titolo: 'Risultato di «ua»' }];
    const nuovi = [{ tipo: 'board.board', id: '2', titolo: 'Risultato di «uat»' }];

    it.each<[string, (ua: ReturnType<typeof inAttesaDellaRicerca>, uat: ReturnType<typeof inAttesaDellaRicerca>) => Promise<void>]>([
        ['arriva prima della nuova', async (ua, uat) => {
            await ua.arriva(trovati(vecchi));
            // La parola è «uat»: la ricerca resta in caricamento, senza i risultati di «ua».
            expect(inCaricamento()).toBe('Sto cercando…');
            expect(righe()).toHaveLength(0);
            await uat.arriva(trovati(nuovi));
        }],
        ['arriva dopo la nuova', async (ua, uat) => {
            await uat.arriva(trovati(nuovi));
            await ua.arriva(trovati(vecchi));
        }],
        ['annullata, finisce con un errore', async (ua, uat) => {
            await ua.fallisce(new DOMException('The operation was aborted.', 'AbortError'));
            expect(inCaricamento()).toBe('Sto cercando…');
            expect(uno('.zr-search-panel [role="alert"]')).toBeNull();
            await uat.arriva(trovati(nuovi));
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
        vi.stubGlobal('fetch', vi.fn(async () => trovati(risultatiDelServer)));
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
        // Con `app: 'crm'` l'indirizzo resta quello di Project Management.
        ['Report marketing', 'https://board.zeiras.com/w/acme-marketing/b/uat-13'],
    ])('scegliere «%s» apre l\'indirizzo del prodotto che ha quel tipo nel registro, nel workspace della risposta — qui quello dei dati —, seguito dal percorso del tipo, anche da un altro prodotto (sprint 5 · T4.3; sprint 6 · T5.1; sprint 22 · T6.5)', async (titolo, indirizzo) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati(risultatiDelServer)));
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

    /**
     * Una risposta coi sei tipi di `ricerca.crea` (dalla `v1.15.0`), mescolati perché l'ordine dei gruppi non sia quello del
     * registro: ogni risultato col suo `contesto`, i testi che il backoffice dà per riconoscerlo — `null`, o un oggetto coi
     * due testi, con uno solo o con nessuno. In mezzo, un contatto con l'id fuori forma e un tipo che il registro non ha: non
     * si mostrano.
     */
    const diOgniTipo = [
        { tipo: 'crm.persona', id: '01k7b1p1', titolo: 'Grace Hopper', contesto: { organizzazione: 'Acme Srl', ruolo: 'CTO' } },
        { tipo: 'board.scheda', id: '01k7b1s1', titolo: 'Scrivere il brief', contesto: { board: 'Lancio Q4', lista: 'Da fare' } },
        { tipo: 'crm.persona', id: '..', titolo: 'Contatto fuori forma', contesto: { organizzazione: 'Acme Srl', ruolo: null } },
        { tipo: 'crm.organizzazione', id: '01k7b1o1', titolo: 'Acme Srl', contesto: null },
        { tipo: 'crm.trattativa', id: '01k7b1t1', titolo: 'Rinnovo 2027', contesto: { pipeline: 'Vendite', fase: 'Proposta' } },
        { tipo: 'crm.attivita', id: '01k7b1a1', titolo: 'Richiamare Grace', contesto: null },
        { tipo: 'board.board', id: '01k7b1b1', titolo: 'Lancio Q4', contesto: null },
        { tipo: 'crm.persona', id: '01k7b1p2', titolo: 'Alan Turing', contesto: { organizzazione: null, ruolo: 'Consulente' } },
        { tipo: 'board.cartelle', id: '01k7b1c1', titolo: 'Marketing', contesto: null },
        { tipo: 'board.scheda', id: '01k7b1s2', titolo: 'Brief del lancio', contesto: { board: 'Lancio Q4', lista: null } },
        { tipo: 'crm.persona', id: '01k7b1p3', titolo: 'Ada Byron', contesto: { organizzazione: null, ruolo: null } },
    ];

    it.each<[lingua: string, gruppi: string[], pm: string, crm: string]>([
        ['it', ['Contatti', 'Schede', 'Aziende', 'Opportunità', 'Board', 'Cartelle'], 'Project Management', 'CRM'],
        ['es', ['Contactos', 'Tarjetas', 'Empresas', 'Oportunidades', 'Tableros', 'Carpetas'], 'Gestión de proyectos', 'CRM'],
        ['en', ['Contacts', 'Cards', 'Companies', 'Opportunities', 'Boards', 'Folders'], 'Project Management', 'CRM'],
    ])('con la lingua "%s", schede, contatti, aziende e opportunità stanno ognuno nel suo gruppo, con la seconda riga fatta dei testi di `contesto` che ci sono, il nome e il tono del loro modulo e l\'icona del tipo; i gruppi nell\'ordine del primo risultato di ognuno e dentro un gruppo l\'ordine del backoffice; un tipo che il registro non ha e un id fuori forma non compaiono (sprint 25 · T4.1, T4.2)', async (lingua, gruppi, pm, crm) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati(diOgniTipo)));
        await mostra(<Cornice dati={{ ...dati, lingua }} onLogout={esciSenzaEffetto} />);

        await scrivi('uat');
        expect(tutti('.zr-search-panel .zr-search-group').map((gruppo) => gruppo.textContent)).toStrictEqual(gruppi);
        expect(righe().map((riga) => [riga.querySelector('.zr-search-title')?.textContent, riga.querySelector('.zr-search-sub')?.textContent ?? null, riga.querySelector('.zr-search-product')?.textContent])).toStrictEqual([
            ['Grace Hopper', 'Acme Srl · CTO', crm],
            ['Alan Turing', 'Consulente', crm],
            ['Ada Byron', null, crm],
            ['Scrivere il brief', 'Lancio Q4 · Da fare', pm],
            ['Brief del lancio', 'Lancio Q4', pm],
            ['Acme Srl', null, crm],
            ['Rinnovo 2027', 'Vendite · Proposta', crm],
            ['Lancio Q4', null, pm],
            ['Marketing', null, pm],
        ]);
        expect(righe().map((riga) => [...(riga.querySelector('.zr-iconbox')?.classList ?? [])].find((classe) => classe.startsWith('zr-label-'))))
            .toStrictEqual(['zr-label-sky', 'zr-label-sky', 'zr-label-sky', 'zr-label-pine', 'zr-label-pine', 'zr-label-sky', 'zr-label-sky', 'zr-label-pine', 'zr-label-pine']);
        expect(righe().map((riga) => riga.querySelector('.zr-iconbox path')?.getAttribute('d')))
            .toStrictEqual((['users', 'users', 'users', 'file', 'file', 'building', 'target', 'board', 'folder'] as const).map((icona) => tracciatoDi(icona)));
    });

    it.each([
        ['Scrivere il brief', 'https://board.zeiras.com/w/zeta-ricerca/c/01k7b1s1'],
        ['Grace Hopper', 'https://crm.zeiras.com/w/zeta-ricerca/contatti/01k7b1p1'],
        ['Acme Srl', 'https://crm.zeiras.com/w/zeta-ricerca/aziende/01k7b1o1'],
        ['Rinnovo 2027', 'https://crm.zeiras.com/w/zeta-ricerca/opportunita/01k7b1t1'],
    ])('scegliere «%s» apre la sua pagina nel modulo che ha quel tipo nel registro, nel workspace che la risposta dice e non in quello della pagina (sprint 25 · T4.1)', async (titolo, indirizzo) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati(diOgniTipo, 'zeta-ricerca')));
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await scrivi('uat');
        const scelto = righe().find((riga) => riga.querySelector('.zr-search-title')?.textContent === titolo);
        expect(scelto).toBeDefined();
        await act(async () => {
            scelto?.click();
            await giro();
        });
        expect(naviga.mock.calls).toStrictEqual([[indirizzo]]);
    });

    it.each<[caso: string, contesto: unknown, secondaRiga: string | null]>([
        ['che manca, come in una risposta finta di prima della `v1.15.0`', undefined, null],
        ['`null`', null, null],
        ['senza le chiavi del tipo', {}, null],
        ['coi due testi', { board: 'Lancio Q4', lista: 'Da fare' }, 'Lancio Q4 · Da fare'],
        ['col solo secondo testo', { board: null, lista: 'Da fare' }, 'Da fare'],
        ['con un testo vuoto e uno di soli spazi', { board: '', lista: '  ' }, null],
        ['coi testi con gli spazi intorno', { board: ' Lancio Q4 ', lista: 'Da fare\n' }, 'Lancio Q4 · Da fare'],
        ['con valori che non sono testi', { board: 12, lista: { nome: 'Da fare' } }, null],
        ['con le chiavi di un altro tipo', { organizzazione: 'Acme Srl', ruolo: 'CTO', pipeline: 'Vendite' }, null],
        ['che è un testo', 'Lancio Q4', null],
        ['che è un elenco', ['Lancio Q4', 'Da fare'], null],
    ])('la seconda riga di una scheda con un `contesto` %s: solo i testi che ci sono, nell\'ordine del registro, mai `null`, `undefined` o un « · » appeso (sprint 25 · T4.1)', async (_caso, contesto, secondaRiga) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati([{ tipo: 'board.scheda', id: '01k7b1s1', titolo: 'Scrivere il brief', ...(contesto === undefined ? {} : { contesto }) }])));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('brief');
        expect(titoli()).toStrictEqual(['Scrivere il brief']);
        expect(righe()[0]?.querySelector('.zr-search-sub')?.textContent ?? null).toBe(secondaRiga);
    });

    // Sprint 26 · T5 (voce #1767; lettura della PR #56, R10). « · » sta scritto nel codice della cornice e non fra i testi delle
    // lingue: è il segno che il design system scrive da sé fra due testi di una riga dell'`AppShell`. Il caso lega i due: il segno
    // si legge dall'`AppShell` da solo, fra il prodotto e l'ora di una notifica, e la seconda riga di un risultato usa quello.
    it('i due testi della seconda riga di un risultato sono uniti dal segno che l\'`AppShell` del design system scrive da sé fra il prodotto e l\'ora di una notifica: se uno dei due cambia, non sono più lo stesso (sprint 26 · T5.3)', async () => {
        await mostra(<componenti.AppShell user="Ada Lovelace" notifications={[{ id: 'n1', title: 'Una notifica', product: 'Prima', time: 'dopo' }]} />);
        await act(async () => {
            uno('.zr-bell')?.click();
            await giro();
        });
        const riga = uno('.zr-notif-meta')?.textContent ?? '';
        expect([riga.startsWith('Prima'), riga.endsWith('dopo')]).toStrictEqual([true, true]);
        const delDesignSystem = riga.slice('Prima'.length, riga.length - 'dopo'.length);
        expect(delDesignSystem.trim()).not.toBe('');

        vi.stubGlobal('fetch', vi.fn(async () => trovati([{ tipo: 'board.scheda', id: '01k7b1s1', titolo: 'Scrivere il brief', contesto: { board: 'Lancio Q4', lista: 'Da fare' } }])));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        await scrivi('brief');
        expect(righe()[0]?.querySelector('.zr-search-sub')?.textContent).toBe(`Lancio Q4${delDesignSystem}Da fare`);
    });

    it('una board o una cartella non ha una seconda riga, nemmeno con un `contesto`: quali testi la fanno lo dice il registro, tipo per tipo (sprint 25 · T4.1)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati([
            { tipo: 'board.board', id: '01k7b1b1', titolo: 'Lancio Q4', contesto: { board: 'Lancio Q4', lista: 'Da fare' } },
            { tipo: 'board.cartelle', id: '01k7b1c1', titolo: 'Marketing', contesto: { organizzazione: 'Acme Srl' } },
        ])));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('uat');
        expect(titoli()).toStrictEqual(['Lancio Q4', 'Marketing']);
        expect(tutti('.zr-search-panel .zr-search-sub')).toHaveLength(0);
    });

    it('due cartelle si aprono sulla stessa pagina del workspace e restano due risultati (sprint 6 · T5.1)', async () => {
        const cartelle = [
            { tipo: 'board.cartelle', id: 'uat-c1', titolo: 'Clienti' },
            { tipo: 'board.cartelle', id: 'uat-c2', titolo: 'Marketing' },
        ];
        vi.stubGlobal('fetch', vi.fn(async () => trovati(cartelle)));
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

        await elenco.arriva(trovati(risultati));
        expect(inCaricamento()).toBeUndefined();
        expect(uno('.zr-search-panel [role="status"] strong')?.textContent).toBe('Nessun risultato per «caffè latte»');
        expect(uno('.zr-search-panel [role="alert"]')).toBeNull();
    });

    it.each<[string, () => Promise<Response>]>([
        ['una risposta 502', async () => risposta({ errore: 'backoffice_non_risponde' }, 502)],
        ['una risposta 422', async () => risposta({ errore: 'dati_non_validi' }, 422)],
        ['la rete giù', async () => { throw new TypeError('Failed to fetch'); }],
        ['un 200 senza lista', async () => risposta({ data: null, workspace: 'acme-marketing' })],
    ])('con %s la ricerca mostra il suo errore, non «Nessun risultato» (T5.4)', async (_caso, fallisce) => {
        vi.stubGlobal('fetch', vi.fn(fallisce));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(uno('.zr-search-panel [role="alert"]')?.textContent).toBe('La ricerca non ha risposto. Riprova tra poco.');
        expect(uno('.zr-search-panel')?.textContent).not.toContain('Nessun risultato per');
        expect(righe()).toHaveLength(0);
    });

    // Sprint 22 · T6 (voce #1726): la sessione ha un workspace solo. Con due schede su due workspace la scheda rimasta indietro
    // cerca in quello in cui la persona è entrata per ultimo: la risposta dice di quale workspace sono i risultati, e si aprono
    // lì. Senza `workspace` non c'è un indirizzo sicuro, e nemmeno una pagina di ripiego: è un errore della ricerca.

    it.each([
        ['Lancio Q4', 'https://board.zeiras.com/w/acme-vendite/b/01k6w2d5f7h9k1n3q5s7v9x1z3'],
        ['Marketing', 'https://board.zeiras.com/w/acme-vendite'],
        ['Report marketing', 'https://board.zeiras.com/w/acme-vendite/b/uat-13'],
    ])('con la risposta di un altro workspace, scegliere «%s» apre il suo indirizzo nel workspace che la risposta dice, mai in quello dei dati della pagina (sprint 22 · T6.5)', async (titolo, indirizzo) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati(risultatiDelServer, 'acme-vendite')));
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
    });

    it('i risultati di una parola restano del loro workspace: la parola dopo, cercata in un altro, apre i suoi nel suo (sprint 22 · T6.5)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, opzioni?: RequestInit) => (parolaDi(opzioni) === 'ua' ? trovati(vecchi, 'acme-vendite') : trovati(nuovi)));
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await scrivi('ua');
        await act(async () => {
            righe()[0]?.click();
            await giro();
        });
        await scrivi('uat');
        await act(async () => {
            righe()[0]?.click();
            await giro();
        });
        expect(naviga.mock.calls).toStrictEqual([['https://board.zeiras.com/w/acme-vendite/b/1'], ['https://board.zeiras.com/w/acme-marketing/b/2']]);
    });

    it.each<[string, unknown]>([
        ['senza `workspace`', { data: risultatiDelServer }],
        ['con `workspace` null', { data: risultatiDelServer, workspace: null }],
        ['con un `workspace` che non è un testo', { data: risultatiDelServer, workspace: { slug: 'acme-marketing' } }],
        ['con un `workspace` vuoto', { data: risultatiDelServer, workspace: '' }],
    ])('una risposta %s è un errore della ricerca: il pannello mostra il suo errore e nessun risultato, mai i risultati aperti nel workspace della pagina (sprint 22 · T6.6)', async (_caso, corpo) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta(corpo)));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(uno('.zr-search-panel [role="alert"]')?.textContent).toBe('La ricerca non ha risposto. Riprova tra poco.');
        expect(uno('.zr-search-panel')?.textContent).not.toContain('Nessun risultato per');
        expect(righe()).toHaveLength(0);
    });

    // Sprint 23 · T2 (voce #1742, S4): lo `workspace` della risposta entra nell'indirizzo di ogni risultato solo con la forma di
    // uno slug, come per una notifica. Fuori forma è l'errore della ricerca: nessun risultato, e quindi nessun indirizzo.
    it.each(['..', '.', 'Acme', 'a/b', 'acme_marketing'])('una risposta con un `workspace` fuori dalla forma di uno slug — «%s» — è un errore della ricerca: il pannello mostra il suo errore e nessun risultato da aprire (sprint 23 · T2.3)', async (workspace) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultatiDelServer, workspace })));
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(uno('.zr-search-panel [role="alert"]')?.textContent).toBe('La ricerca non ha risposto. Riprova tra poco.');
        expect(uno('.zr-search-panel')?.textContent).not.toContain('Nessun risultato per');
        expect(righe()).toHaveLength(0);
    });

    // Sprint 24 · T4 (voce #1754; lettura della PR #51, R5). L'id di un risultato arriva dal backoffice, e la parte server guarda
    // solo che sia un testo: entra nell'indirizzo solo con la forma di un id, come quello di una notifica. `encodeURIComponent`
    // non tocca i punti, e con `..` l'indirizzo sarebbe quello della pagina del workspace. Un risultato con l'id fuori forma non
    // compare, nemmeno se il suo tipo non mette l'id nell'indirizzo (una cartella); gli altri della stessa risposta sì. E la
    // forma si guarda solo di un testo (lettura della PR #52, R7): `RegExp.test` converte ciò che riceve, e un id che manca,
    // `null` o un numero passerebbe come «undefined», «null», «12».
    it.each<[string, unknown]>([
        ['`..`', '..'],
        ['vuoto', ''],
        ['con una barra', 'uat/13'],
        ['più lungo di 64', 'a'.repeat(65)],
        ['che manca', undefined],
        ['`null`', null],
        ['che è un numero, non un testo', 12],
    ])('un risultato della ricerca con l\'id %s non compare fra i risultati, e gli altri della stessa risposta sì: la ricerca non va in errore (sprint 24 · T4.2)', async (_quale, id) => {
        vi.stubGlobal('fetch', vi.fn(async () => trovati([
            { tipo: 'board.board', id: 'uat-12', titolo: 'Lancio Q4' },
            { tipo: 'board.board', id, titolo: 'Lancio fuori forma' },
            { tipo: 'board.cartelle', id, titolo: 'Marketing fuori forma' },
            // Il più lungo che la forma ammette.
            { tipo: 'board.board', id: 'a'.repeat(64), titolo: 'Report marketing' },
        ])));
        const naviga = vi.fn();
        await mostra(<Cornice dati={dati} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await scrivi('lancio');
        expect(uno('.zr-search-panel [role="alert"]')).toBeNull();
        expect(titoli()).toStrictEqual(['Lancio Q4', 'Report marketing']);

        // Quelli rimasti si aprono come sempre.
        await act(async () => {
            righe()[1]?.click();
            await giro();
        });
        expect(naviga.mock.calls).toStrictEqual([[`https://board.zeiras.com/w/acme-marketing/b/${'a'.repeat(64)}`]]);
    });

    // Sprint 23 · T2 (voce #1742, S7): lo stato della ricerca è un'unione, e dei risultati stanno sempre col loro workspace.
    it('uno stato della ricerca coi risultati porta il loro workspace: senza non compila, e prima di cercare la ricerca è pronta e senza risultati (sprint 23 · T2.7)', async () => {
        // @ts-expect-error `ready` vuole `workspace`: dei risultati senza il loro workspace non hanno un indirizzo.
        const senzaWorkspace: StatoDellaRicerca = { stato: 'ready', risultati: [] };
        expect(senzaWorkspace.stato).toBe('ready');

        // Prima della prima parola all'`AppShell` arriva ciò che arrivava: né un errore, né un caricamento, né un risultato.
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
        expect([appShell.mock.lastCall?.[0].searchState, appShell.mock.lastCall?.[0].searchResults]).toStrictEqual(['ready', []]);
    });

    it.each([
        // Contati in caratteri, come `mb_strlen` della parte server, non in unità UTF-16: un'emoji ne vale due.
        ['101 emoji', '😀'.repeat(101), '😀'.repeat(100)],
        ['60 emoji', '😀'.repeat(60), '😀'.repeat(60)],
        ['150 lettere accentate', 'à'.repeat(150), 'à'.repeat(100)],
    ])('una parola di %s arriva alla parte server coi primi 100 caratteri, e la ricerca risponde invece di dare errore (T5.4)', async (_caso, parola, mandata) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => trovati([risultatiDelServer[0]]));
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
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => trovati([risultatiDelServer[0]]));
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
    // Sprint 24 · T2 (voce #1745): chi non ha accettato i documenti legali in vigore non cerca. Coi dati che lo dicono la
    // ricerca non parte; coi dati di sempre lo dice la rotta, col suo 403, e da lì la cornice è ridotta (il resto dello stato
    // lo prova «chi non ha accettato i documenti legali», più sotto).
    const spenta = 'Non disponibile finché non accetti i documenti.';
    const sottoIlCampo = () => tutti('.zr-search-note').map((nota) => nota.textContent);

    it.each([
        ['una lettera', 'l'],
        ['tre lettere', 'lan'],
    ])('a chi non ha accettato i documenti legali, scrivendo %s, sotto il campo c\'è «Non disponibile finché non accetti i documenti.» e nessun risultato, e la ricerca non parte (sprint 24 · T2.2)', async (_quante, parola) => {
        const fetchFinto = vi.fn(async () => risposta({ data: risultatiDelServer, workspace: 'acme-marketing' }));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, prodotti: {}, aziende: [], non_lette: 0, accettazione_richiesta: true }} onLogout={esciSenzaEffetto} />);

        await scrivi(parola);
        expect(sottoIlCampo()).toStrictEqual([spenta]);
        expect(righe()).toHaveLength(0);
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    it('coi dati di sempre, se la ricerca risponde 403 `accettazione_richiesta` la cornice passa allo stato ridotto: sotto il campo c\'è quella frase, non «La ricerca non ha risposto», e un\'altra parola non parte (sprint 24 · T2.5)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ errore: 'accettazione_richiesta' }, 403));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={{ ...dati, non_lette: 7 }} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        await scrivi('lancio');
        expect(partite(fetchFinto)).toStrictEqual([ricercaDi('lancio')]);
        expect(sottoIlCampo()).toStrictEqual([spenta]);
        expect(righe()).toHaveLength(0);
        expect([uno('main .zr-alert strong')?.textContent, uno('.zr-bell-count'), uno('.zr-product-switch')]).toStrictEqual(['Ci sono documenti da accettare', null, null]);

        await scrivi('lancio q4');
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        expect(sottoIlCampo()).toStrictEqual([spenta]);
    });

    it.each<[string, unknown, number]>([
        ['un 403 con un altro `errore`', { errore: 'gettone_senza_workspace' }, 403],
        ['un 409 con lo stesso `errore`', { errore: 'accettazione_richiesta' }, 409],
        ['un 500 con lo stesso `errore`', { errore: 'accettazione_richiesta' }, 500],
    ])('%s dalla ricerca non porta la cornice in quello stato: resta l\'errore della ricerca, e la cornice è quella di sempre (sprint 24 · T2.5)', async (_caso, corpo, stato) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta(corpo, stato)));
        await mostra(<Cornice dati={{ ...dati, non_lette: 7 }} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        await scrivi('lancio');
        expect(sottoIlCampo()).toStrictEqual(['La ricerca non ha risposto. Riprova tra poco.']);
        expect([uno('main .zr-alert'), uno('.zr-bell-count')?.textContent, uno('.zr-product-switch') === null]).toStrictEqual([null, '7', false]);
    });

    // Sprint 26 · T4 (lettura della PR #56, R8). Il freno del backoffice: quando la ricerca risponde 429 con `Retry-After: N`, per
    // N secondi — al più 60 — la cornice non manda altre ricerche, qualunque cosa la persona scriva, e resta sull'errore; passati,
    // la prima parola scritta parte. Allo scadere non parte niente da solo. Un 429 che non dice i secondi, e ogni altro errore,
    // sono l'errore di oggi: la parola dopo parte.
    describe('il freno del backoffice', () => {
        // Qui anche l'orologio è del test: i secondi del freno passano quando lo dice lui.
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
        });

        const errore = 'La ricerca non ha risposto. Riprova tra poco.';
        /** La risposta di una rotta che frena: lo stato, il codice e, se c'è, `Retry-After`, come `fetch` la dà. */
        const frenata = (riprovaFra?: string, stato = 429) => ({
            ok: false,
            status: stato,
            headers: new Headers(riprovaFra === undefined ? {} : { 'Retry-After': riprovaFra }),
            json: async () => ({ errore: 'troppe_richieste' }),
        }) as unknown as Response;
        /** La prima ricerca riceve `prima`; le altre trovano un risultato che porta la loro parola. */
        const primaPoiTrova = (prima: Response) => vi.fn(async (_indirizzo: string, opzioni?: RequestInit) => trovati([{ tipo: 'board.board', id: '1', titolo: `Risultato di «${String(parolaDi(opzioni))}»` }])).mockResolvedValueOnce(prima);
        const passano = async (millisecondi: number) => act(async () => {
            await vi.advanceTimersByTimeAsync(millisecondi);
        });

        it('dopo un 429 con `Retry-After: 5` la cornice mostra l\'errore della ricerca e per 5 secondi non manda altre ricerche, qualunque cosa la persona scriva; allo scadere non parte niente da solo, e la prima parola scritta dopo parte (sprint 26 · T4.2)', async () => {
            const fetchFinto = primaPoiTrova(frenata('5'));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);

            await scrivi('lancio');
            expect(partite(fetchFinto)).toStrictEqual([ricercaDi('lancio')]);
            expect(sottoIlCampo()).toStrictEqual([errore]);

            // Nei 5 secondi: tre parole, e nessuna parte.
            await scrivi('lancio q');
            await scrivi('lancio q4');
            await passano(3000);
            await scrivi('piano');
            expect(fetchFinto).toHaveBeenCalledTimes(1);
            expect(sottoIlCampo()).toStrictEqual([errore]);

            // Il freno scade, e passa altro tempo: senza un tasto non parte niente, nemmeno l'ultima parola scritta.
            await passano(30_000);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
            expect(sottoIlCampo()).toStrictEqual([errore]);

            await scrivi('piano di lancio');
            expect(partite(fetchFinto)).toStrictEqual([ricercaDi('lancio'), ricercaDi('piano di lancio')]);
            expect(titoli()).toStrictEqual(['Risultato di «piano di lancio»']);
        });

        it.each<[string, string, number, boolean]>([
            ['`Retry-After: 5`: a 4,999 secondi dal 429 la parola non parte', '5', 4999, false],
            ['`Retry-After: 5`: a 5 secondi dal 429 la parola parte', '5', 5000, true],
            ['`Retry-After: 1`: a 0,999 secondi la parola non parte', '1', 999, false],
            ['`Retry-After: 1`: a 1 secondo la parola parte', '1', 1000, true],
            // Il tetto: un valore sbagliato del backoffice non spegne la ricerca per un'ora.
            ['`Retry-After: 3600`: a 59,999 secondi la parola non parte', '3600', 59_999, false],
            ['`Retry-After: 3600`: il freno è di 60 secondi, e a 60 la parola parte', '3600', 60_000, true],
            // Lettura della PR #59, R9: la riga di prima, da sola, resta verde anche se quel valore non frenasse affatto.
            ['`Retry-After` con più cifre di quante un numero ne tenga: a 59,999 secondi la parola non parte', '9'.repeat(400), 59_999, false],
            ['`Retry-After` con più cifre di quante un numero ne tenga: il freno è di 60 secondi, e a 60 la parola parte', '9'.repeat(400), 60_000, true],
        ])('il freno dura i secondi di `Retry-After`, al più 60, dal momento del 429 — %s (sprint 26 · T4.2)', async (_caso, riprovaFra, dopo, parte) => {
            const fetchFinto = primaPoiTrova(frenata(riprovaFra));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
            await scrivi('lancio');
            expect(sottoIlCampo()).toStrictEqual([errore]);

            // L'`AppShell` chiama la cornice 300 ms dopo il tasto: il tasto cade 300 ms prima dell'istante che si prova.
            await passano(dopo - 300);
            await scrivi('lancio q4');
            expect(partite(fetchFinto)).toStrictEqual(parte ? [ricercaDi('lancio'), ricercaDi('lancio q4')] : [ricercaDi('lancio')]);
            expect([titoli(), sottoIlCampo()]).toStrictEqual(parte ? [['Risultato di «lancio q4»'], []] : [[], [errore]]);
        });

        it.each<[string, () => Response]>([
            ['un 429 senza `Retry-After`', () => frenata()],
            ['un 429 con `Retry-After: 0`', () => frenata('0')],
            ['un 429 con `Retry-After: -1`', () => frenata('-1')],
            ['un 429 con `Retry-After: 1.5`', () => frenata('1.5')],
            ['un 429 con `Retry-After: abc`', () => frenata('abc')],
            ['un 429 con una data in `Retry-After`', () => frenata('Wed, 21 Oct 2026 07:28:00 GMT')],
            ['un 500 con `Retry-After: 5`', () => frenata('5', 500)],
            ['un 403 con `Retry-After: 5`', () => frenata('5', 403)],
        ])('%s è l\'errore di oggi e non frena: la parola dopo parte subito (sprint 26 · T4.3)', async (_caso, risponde) => {
            const fetchFinto = primaPoiTrova(risponde());
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
            await scrivi('lancio');
            expect(sottoIlCampo()).toStrictEqual([errore]);

            await scrivi('lancio q4');
            expect(partite(fetchFinto)).toStrictEqual([ricercaDi('lancio'), ricercaDi('lancio q4')]);
            expect(titoli()).toStrictEqual(['Risultato di «lancio q4»']);
        });

        it('mentre la ricerca è frenata un tasto non mostra il caricamento: lo stato resta l\'errore, sia nei 300 ms dopo il tasto sia quando l\'`AppShell` chiama la cornice (sprint 26 · T4.4)', async () => {
            const fetchFinto = primaPoiTrova(frenata('5'));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} />);
            await scrivi('lancio');
            const visto = () => [sottoIlCampo(), inCaricamento(), righe().length];
            expect(visto()).toStrictEqual([[errore], undefined, 0]);

            const campo = uno('.zr-search input') as HTMLInputElement;
            await act(async () => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, 'lancio q4');
                campo.dispatchEvent(new Event('input', { bubbles: true }));
                await vi.advanceTimersByTimeAsync(299);
            });
            expect(visto()).toStrictEqual([[errore], undefined, 0]);
            // Il millisecondo in cui l'`AppShell` chiama `onSearch`, senza lasciar passare altro.
            await act(async () => {
                vi.advanceTimersByTime(1);
            });
            expect(visto()).toStrictEqual([[errore], undefined, 0]);
            await passano(1000);
            expect(visto()).toStrictEqual([[errore], undefined, 0]);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });
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

    it('con active={null} nessuna voce della barra è segnata, in una pagina di app.zeiras.com: né la Dashboard né un prodotto del menu Moduli (sprint 12 · T5.1)', async () => {
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} active={null} />);

        // Le voci del menu Moduli e «Impostazioni», che l'`AppShell` mette da sé in fondo alla barra.
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
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={dati} onLogout={esciSenzaEffetto} {...pagina} {...attiva} />);

        expect(segnate()).toStrictEqual(attese);
        // All'`AppShell` arriva ciò che ha dato il frontend, com'è.
        expect(appShell.mock.lastCall?.[0].active).toBe(attiva.active);
    });

    it('nessuna voce può avere l\'id con cui la cornice dice «nessuna»: data una voce proprio con quell\'id, non è segnata, e l\'id è un altro (sprint 12 · T5.4)', async () => {
        const appShell = vi.spyOn(componenti, 'AppShell');
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

// Sprint 19 · review della PR #23, R3 e N1: ciò che la cornice decide da sé — il selettore, «Nuovo workspace», il numero sulla
// campanella, «Segna tutte come lette», le voci del menu del profilo — non lo cambia una prop con lo stesso nome arrivata fuori dal tipo, con uno
// spread, nemmeno quando la cornice non ha niente da dare: come nella `v1.8.0`, dove la sua prop valeva `undefined` e copriva
// quella del frontend.
describe('una prop fuori da `CorniceProps` non prende il posto di ciò che decide la cornice', () => {
    it('con uno spread di props che `Cornice` non ha, quando la cornice non dà niente al loro posto all\'`AppShell` non arrivano (sprint 19 · review, R3)', async () => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        const fuoriDalTipo = {
            companies: [{ id: 'x', name: 'X', workspaces: [{ slug: 'x', name: 'X' }] }],
            unreadCount: 99,
            onMarkAllRead: () => {},
            accountItems: [{ label: 'Voce del frontend' }],
            onNewWorkspace: () => {},
        };
        // Senza aziende, senza non lette, senza notifiche caricate, con `piano`: la cornice non dà nessuna delle cinque.
        await mostra(<Cornice {...(fuoriDalTipo as object)} dati={dati} onLogout={esciSenzaEffetto} piano />);

        expect(appShell).toHaveBeenCalled();
        const props = (appShell.mock.lastCall?.[0] ?? {}) as Record<string, unknown>;
        expect(Object.keys(fuoriDalTipo).map((nome) => [nome, props[nome]])).toStrictEqual(Object.keys(fuoriDalTipo).map((nome) => [nome, undefined]));
    });
});

// Sprint 24 · T2 (voce #1745): chi non ha ancora accettato i documenti legali in vigore. La parte server dà i dati ridotti con
// `accettazione_richiesta: true` (T1), o una rotta della cornice risponde 403 `accettazione_richiesta` mentre la cornice ha i
// dati di sempre: la cornice esce ridotta — nel menu Moduli solo la Dashboard, campanella e ricerca spente — e sopra la
// pagina c'è l'avviso col pulsante che porta alla pagina dell'accettazione, che è di zr-home. La ricerca spenta la prova
// «la ricerca», più sopra.
describe('chi non ha accettato i documenti legali', () => {
    /** I dati ridotti, come li dà `Cornice::dati()` davanti al 403 del backoffice. */
    const ridotti: DatiDellaCornice = { ...dati, prodotti: [], aziende: [], non_lette: 0, aggiornati_il: '2026-10-11T22:00:00.000001Z', accettazione_richiesta: true };
    /** I dati di chi ha accettato: moduli, aziende, sette non lette. */
    const diSempre: DatiDellaCornice = { ...dati, aziende, non_lette: 7, aggiornati_il: '2026-10-11T22:00:00.000001Z' };
    const spenta = 'Non disponibile finché non accetti i documenti.';
    const daAccettare = () => risposta({ errore: 'accettazione_richiesta' }, 403);
    const avviso = () => uno('main .zr-alert');
    /** I pulsanti del pannello che non sono le sue due schede: «Segna tutte come lette», «Riprova», «Vedi tutte». */
    const pulsantiDelPannello = () => tutti('.zr-notif button:not([role="tab"])').map((pulsante) => pulsante.textContent);
    /** Ciò che dice in pagina se la cornice è ridotta: le voci del menu Moduli, il modulo aperto, il numero, il titolo dell'avviso. */
    const cornice = () => ({
        moduli: [...(uno('.zr-nav .zr-nav-group')?.querySelectorAll('a.zr-nav-item') ?? [])].map((voce) => [voce.querySelector('.zr-nav-label')?.textContent, voce.getAttribute('href')]),
        moduloAperto: uno('.zr-product-switch') !== null || uno('.zr-top-product') !== null,
        numero: uno('.zr-bell-count')?.textContent ?? null,
        avviso: avviso()?.querySelector('strong')?.textContent ?? null,
    });
    const ridotta = { moduli: [['Dashboard', 'https://app.zeiras.com/w/acme-marketing']], moduloAperto: false, numero: null, avviso: 'Ci sono documenti da accettare' };
    /** La cornice di sempre su una pagina di Project Management: il menu chiuso nel suo pulsante, «7» sulla campanella, nessun avviso. */
    const diSempreInPagina = () => [uno('.zr-product-switch') !== null, uno('.zr-bell-count')?.textContent ?? null, avviso()];
    const l = (indirizzo: string) => (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(indirizzo);
    let diPartenza: string;

    beforeEach(() => {
        diPartenza = window.location.href;
    });

    afterEach(() => {
        l(diPartenza);
    });

    it.each<[string, string | undefined]>([
        ['una pagina di app.zeiras.com', undefined],
        ['una pagina di un modulo', 'pm'],
    ])('coi dati `accettazione_richiesta: true` %s esce con la cornice ridotta: nel menu Moduli solo la Dashboard, nessun numero sulla campanella, e sopra il contenuto, che resta, l\'avviso con titolo, frase e pulsante (sprint 24 · T2.1)', async (_quale, product) => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        const delModulo: GruppoDiVoci[] = [{ group: 'Lavoro', items: [{ id: 'board', label: 'Le board', icon: 'board' }] }];
        const crea = [{ label: 'Nuova board' }];
        await mostra(<Cornice dati={ridotti} product={product} nav={delModulo} active="board" create={crea} flush onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        expect(uno('.zr-nav .zr-nav-group .zr-nav-title')?.textContent).toBe('Moduli');
        expect(cornice()).toStrictEqual(ridotta);
        // Nessun modulo, nemmeno «Presto»; e la campanella si chiama col suo nome, senza un numero.
        expect(uno('.zr-nav-soon')).toBeNull();
        expect(uno('.zr-bell')?.getAttribute('aria-label')).toBe('Notifiche');
        const props = (appShell.mock.lastCall?.[0] ?? {}) as Record<string, unknown>;
        expect('product' in props).toBe(false);
        // Le voci del modulo e il «+» restano quelli che la pagina dà.
        expect(tutti('.zr-nav .zr-nav-group').map((gruppo) => gruppo.querySelector('.zr-nav-title')?.textContent)).toStrictEqual(['Moduli', 'Lavoro']);
        expect(props.create).toBe(crea);
        // L'avviso del design system, col tono di un avviso.
        expect([avviso()?.classList.contains('zr-alert-warning'), avviso()?.getAttribute('role')]).toStrictEqual([true, 'status']);
        expect(avviso()?.querySelector('.zr-alert-body > div')?.textContent).toBe('Per usare Zeiras devi accettare i documenti legali in vigore. Fino ad allora moduli, notifiche e ricerca restano spenti.');
        expect(tutti('main .zr-alert button').map((pulsante) => pulsante.textContent)).toStrictEqual(['Vai ai documenti']);
        // Sta nel margine della pagina: `flush` non arriva all'`AppShell`.
        expect('flush' in props).toBe(false);
        expect(uno('main')?.classList.contains('is-flush')).toBe(false);
        // Il contenuto della pagina resta, dopo l'avviso.
        const pagina = uno('main p');
        expect(pagina?.textContent).toBe('La pagina');
        expect((avviso()?.compareDocumentPosition(pagina as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('la campanella è spenta: il pannello ha la frase e nessuna notifica, senza «Segna tutte come lette», «Riprova» e «Vedi tutte», e la cornice non chiama nessuna delle sue rotte (sprint 24 · T2.2)', async () => {
        const fetchFinto = vi.fn(async () => risposta({ data: [{ id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: 'pm' }], workspace: 'acme-marketing' }));
        vi.stubGlobal('fetch', fetchFinto);
        const appShell = vi.spyOn(componenti, 'AppShell');
        await mostra(<Cornice dati={ridotti} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe(spenta);
        expect(tutti('.zr-notif-list .zr-notif-item')).toHaveLength(0);
        expect([uno('.zr-notif .zr-empty'), uno('.zr-notif .zr-count')]).toStrictEqual([null, null]);
        expect(pulsantiDelPannello()).toStrictEqual([]);
        expect(fetchFinto).not.toHaveBeenCalled();
        // Ciò che l'`AppShell` riceve: nessun gestore di campanella e ricerca, e la frase al posto dei suoi tre testi.
        const props = (appShell.mock.lastCall?.[0] ?? {}) as Record<string, unknown> & { labels?: Record<string, string> };
        expect(['onNotificationsOpen', 'onRetryNotifications', 'onMarkAllRead', 'onAllNotifications', 'onOpenNotification', 'onSearch'].filter((nome) => nome in props)).toStrictEqual([]);
        expect([props.notifications, props.unreadCount, props.notificationsState, props.searchResults, props.searchState]).toStrictEqual([[], 0, 'error', [], 'error']);
        expect([props.labels?.notificationsError, props.labels?.searchHint, props.labels?.searchError]).toStrictEqual([spenta, spenta, spenta]);
    });

    // Sprint 25 · T4 (voce #1639): nello stato ridotto i due testi della ricerca non nominano nessuna fonte, nemmeno coi dati che
    // dicono ancora un modulo attivo (lo stato ridotto lo ha detto una rotta, o i dati li ha ritoccati un frontend): il
    // segnaposto è quello senza fonti, e l'invito resta la frase dell'accettazione.
    it('a chi non ha accettato i documenti legali il segnaposto della ricerca non nomina nessuna fonte, nemmeno coi dati che dicono un modulo attivo, e l\'invito resta la frase dell\'accettazione (sprint 25 · T4.3)', async () => {
        await mostra(<Cornice dati={{ ...dati, accettazione_richiesta: true }} onLogout={esciSenzaEffetto} />);

        expect((uno('.zr-search input') as HTMLInputElement).placeholder).toBe('Cerca…');
        await act(async () => uno('.zr-search input')?.focus());
        expect(uno('.zr-search-note')?.textContent).toBe('Non disponibile finché non accetti i documenti.');
    });

    it.each([
        ['es', 'Hay documentos por aceptar', 'Para usar Zeiras tienes que aceptar los documentos legales vigentes. Hasta entonces los módulos, las notificaciones y la búsqueda quedan desactivados.', 'Ir a los documentos', 'No disponible hasta que aceptes los documentos.'],
        ['en', 'There are documents to accept', 'To use Zeiras you need to accept the legal documents in force. Until then modules, notifications and search stay off.', 'Go to the documents', 'Not available until you accept the documents.'],
        ['zz', 'There are documents to accept', 'To use Zeiras you need to accept the legal documents in force. Until then modules, notifications and search stay off.', 'Go to the documents', 'Not available until you accept the documents.'],
    ])('con la lingua "%s" l\'avviso e la frase della campanella sono in quella lingua, o in inglese se zr-core non la ha (sprint 24 · T2.4)', async (lingua, titolo, frase, pulsante, nonDisponibile) => {
        await mostra(<Cornice dati={{ ...ridotti, lingua }} onLogout={esciSenzaEffetto} />);

        expect([avviso()?.querySelector('strong')?.textContent, avviso()?.querySelector('.zr-alert-body > div')?.textContent, avviso()?.querySelector('button')?.textContent]).toStrictEqual([titolo, frase, pulsante]);
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe(nonDisponibile);
    });

    it('il menu del profilo resta intero, ed «Esci» funziona (sprint 24 · T2.1)', async () => {
        const esci = vi.fn();
        await mostra(<Cornice dati={ridotti} product="pm" onLogout={esci} />);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo().map((voce) => voce?.testo ?? null)).toStrictEqual(['Profilo', 'Impostazioni', 'Azienda', null, 'Esci']);
        await clic(tutti('.zr-profile-menu [role="menuitem"]').at(-1) ?? null);
        expect(esci).toHaveBeenCalledTimes(1);
    });

    const accettazione = 'https://app.zeiras.com/legale/accetta';
    const lunga = (caratteri: number) => `https://board.zeiras.com/${'a'.repeat(caratteri - 'https://board.zeiras.com/'.length)}`;

    it.each<[string, string, string]>([
        ['una pagina `https://`, con la sua query e il suo frammento', 'https://board.zeiras.com/w/acme-marketing/b/01k6?vista=lista&ordine=nome#scheda-12', `${accettazione}?ritorno=https%3A%2F%2Fboard.zeiras.com%2Fw%2Facme-marketing%2Fb%2F01k6%3Fvista%3Dlista%26ordine%3Dnome%23scheda-12`],
        ['una pagina `http://`', 'http://board.zeiras.com/w/acme-marketing', accettazione],
        ['un indirizzo di 2000 caratteri', lunga(2000), `${accettazione}?ritorno=${encodeURIComponent(lunga(2000))}`],
        ['un indirizzo di 2001 caratteri', lunga(2001), accettazione],
    ])('un clic sul pulsante dell\'avviso da %s porta alla pagina dell\'accettazione sull\'host della Dashboard, col `ritorno` solo se l\'indirizzo della pagina comincia con `https://` e non supera i 2000 caratteri (sprint 24 · T2.3)', async (_quale, indirizzo, attesa) => {
        const naviga = vi.fn();
        // La pagina in cui la cornice è resa non è quella del clic: una visita di Inertia cambia l'indirizzo senza rifare la cornice.
        l('https://board.zeiras.com/w/acme-marketing/la-pagina-di-prima');
        await mostra(<Cornice dati={ridotti} product="pm" naviga={naviga} onLogout={esciSenzaEffetto} />);
        l(indirizzo);
        expect(window.location.href).toBe(indirizzo);

        await clic(avviso()?.querySelector('button') ?? null);
        expect(naviga.mock.calls).toStrictEqual([[attesa]]);
    });

    it('coi dati di sempre, se l\'elenco delle notifiche risponde 403 `accettazione_richiesta` la cornice passa allo stato ridotto e ci resta finché ha quei dati; con dati letti dopo che non lo dicono torna quella di sempre (sprint 24 · T2.5)', async () => {
        const fetchFinto = vi.fn(async () => daAccettare());
        vi.stubGlobal('fetch', fetchFinto);
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>;
        await mostra(laPagina(diSempre));
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);

        await clic(uno('.zr-bell'));
        expect(cornice()).toStrictEqual(ridotta);
        // Il pannello, rimasto aperto, ha la frase: non l'errore di caricamento con «Riprova».
        expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe(spenta);
        expect(pulsantiDelPannello()).toStrictEqual([]);
        expect(uno('main p')?.textContent).toBe('La pagina');
        expect(fetchFinto).toHaveBeenCalledTimes(1);

        // La pagina si ridisegna con gli stessi dati: resta ridotta.
        await mostra(laPagina(diSempre));
        expect(cornice()).toStrictEqual(ridotta);

        // Dati letti dopo, che non lo dicono: la cornice torna quella di sempre.
        await mostra(laPagina({ ...diSempre, aggiornati_il: '2026-10-11T22:00:05.000001Z' }));
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);
    });

    // Lettura della PR #52, R1. Il segnale di una rotta non vale per un oggetto solo: un frontend può ricreare i dati a ogni
    // disegno, o ritoccarli nel browser lasciando il segno. Sono la stessa lettura — stesso workspace, stesso segno — e la
    // cornice resta ridotta: non torna quella di sempre con «Non riusciamo a caricare le notifiche» e «Riprova».
    it.each<[string, (deiDati: DatiDellaCornice) => DatiDellaCornice]>([
        ['ricreati uguali a ogni disegno', (deiDati) => ({ ...deiDati })],
        ['ritoccati nel browser lasciando il segno', (deiDati) => ({ ...deiDati, non_lette: 3 })],
    ])('dopo il 403 `accettazione_richiesta` di una rotta, coi dati %s la cornice resta ridotta: il segnale vale finché i dati non sono più recenti, non per un oggetto solo (sprint 24 · T5, R1)', async (_caso, altri) => {
        const fetchFinto = vi.fn(async () => daAccettare());
        vi.stubGlobal('fetch', fetchFinto);
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>;
        await mostra(laPagina(diSempre));
        await clic(uno('.zr-bell'));
        expect(cornice()).toStrictEqual(ridotta);

        await mostra(laPagina(altri(diSempre)));
        expect(cornice()).toStrictEqual(ridotta);
        // Il pannello, rimasto aperto, ha ancora la frase: non l'errore di caricamento con «Riprova».
        expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe(spenta);
        expect(pulsantiDelPannello()).toStrictEqual([]);
        // E un altro disegno ancora, con un altro oggetto: la cornice non chiede di nuovo l'elenco.
        await mostra(laPagina(altri(diSempre)));
        expect(cornice()).toStrictEqual(ridotta);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    // Lettura della PR #52, R5, e seconda lettura, S7 (sprint 25 · T5.5). `Cornice::dati()` dà `prodotti` come lista vuota, e al
    // browser arriva `[]`, non `{}`: è la forma vera dei dati ridotti, quella di `ridotti` qui sopra, e il tipo esportato la
    // ammette senza una conversione. Letta per id non dà niente, come l'oggetto vuoto di dati scritti a mano.
    it('coi `prodotti` dei dati ridotti scritti a mano come un oggetto vuoto (`{}`) la cornice esce ridotta come con la lista vuota (`[]`) che arriva dal server, e il tipo ammette tutte e due le forme (sprint 24 · T5, R5; sprint 25 · T5.5)', async () => {
        const comeDalServer: DatiDellaCornice['prodotti'] = [];
        expect(ridotti.prodotti).toStrictEqual(comeDalServer);
        expectTypeOf(ridotti.prodotti.pm).toEqualTypeOf<'attivo' | 'disponibile' | 'in_arrivo' | undefined>();
        await mostra(<Cornice dati={{ ...ridotti, prodotti: {} }} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

        expect(cornice()).toStrictEqual(ridotta);
        expect(uno('.zr-nav-soon')).toBeNull();
        expect(uno('main p')?.textContent).toBe('La pagina');
    });

    // Lettura della PR #52, R6. Nello stato ridotto il modulo aperto non arriva all'`AppShell`, che senza una voce attiva segna
    // la Dashboard: ma la persona è in una pagina del modulo. Su una pagina di un modulo che non dice la sua voce attiva nessuna
    // voce è segnata; se la dice vale quella, e su una pagina di app.zeiras.com resta la Dashboard.
    it.each<[string, { product?: string; active?: string }, string[]]>([
        ['una pagina di un modulo che non dice la voce attiva', { product: 'pm' }, []],
        // Seconda lettura della PR #52, S5 (sprint 25 · T5.4): una voce attiva vuota per l'`AppShell` è come assente.
        ['una pagina di un modulo che dà una voce attiva vuota', { product: 'pm', active: '' }, []],
        ['una pagina di un modulo che la dice', { product: 'pm', active: 'board' }, ['Le board']],
        ['una pagina di app.zeiras.com', {}, ['Dashboard']],
    ])('nello stato ridotto, su %s le voci segnate nella barra sono quelle giuste: mai la Dashboard per chi è in un modulo (sprint 24 · T5, R6)', async (_quale, dellaPagina, attese) => {
        const delModulo: GruppoDiVoci[] = [{ group: 'Lavoro', items: [{ id: 'board', label: 'Le board', icon: 'board' }] }];
        await mostra(<Cornice dati={ridotti} nav={dellaPagina.product === undefined ? [] : delModulo} {...dellaPagina} onLogout={esciSenzaEffetto} />);

        expect(cornice()).toStrictEqual(ridotta);
        const nomeDi = (voce: HTMLElement) => voce.querySelector('.zr-nav-label')?.textContent;
        expect(tutti('a.zr-nav-item.is-active').map(nomeDi)).toStrictEqual(attese);
        expect(tutti('a.zr-nav-item[aria-current]').map(nomeDi)).toStrictEqual(attese);
    });

    it.each<[string, () => Response]>([
        ['un 403 con un altro `errore`', () => risposta({ errore: 'gettone_senza_workspace' }, 403)],
        ['un 403 con un corpo che non è JSON', () => ({ ok: false, status: 403, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } }) as unknown as Response],
        ['un 409 con lo stesso `errore`', () => risposta({ errore: 'accettazione_richiesta' }, 409)],
        ['un 500 con lo stesso `errore`', () => risposta({ errore: 'accettazione_richiesta' }, 500)],
    ])('%s dall\'elenco delle notifiche non porta la cornice in quello stato: resta l\'errore del pannello, con «Riprova» (sprint 24 · T2.5)', async (_caso, fallisce) => {
        vi.stubGlobal('fetch', vi.fn(async () => fallisce()));
        await mostra(<Cornice dati={diSempre} product="pm" onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif [role="alert"] p')?.textContent).toBe('Non riusciamo a caricare le notifiche.');
        expect(pulsantiDelPannello()).toStrictEqual(['Riprova', 'Vedi tutte']);
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);
    });

    it('lo dice anche «Segna tutte come lette»: se la rotta risponde 403 `accettazione_richiesta` la cornice passa allo stato ridotto (sprint 24 · T2.5)', async () => {
        const elenco = [{ id: 'uat-n41', creata_il: '2026-10-06T11:55:00+00:00', letta: false, app: null }];
        const fetchFinto = vi.fn(async (indirizzo: string) => (indirizzo === '/cornice/notifiche' ? risposta({ data: elenco, workspace: 'acme-marketing' }) : daAccettare()));
        vi.stubGlobal('fetch', fetchFinto);
        await mostra(<Cornice dati={diSempre} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif .zr-pop-head button'));
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(['/cornice/notifiche', '/cornice/notifiche/letture']);
        expect(cornice()).toStrictEqual(ridotta);
        expect(uno('.zr-notif .zr-notif-state p')?.textContent).toBe(spenta);
        expect(pulsantiDelPannello()).toStrictEqual([]);
    });

    it('lo dice anche la lettura di una notifica con un clic: se la rotta risponde 403 `accettazione_richiesta` la risorsa si apre lo stesso, e la cornice passa allo stato ridotto (sprint 24 · T2.5)', async () => {
        const delContatto = { id: 'uat-n69', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } };
        const fetchFinto = vi.fn(async (indirizzo: string) => (indirizzo === '/cornice/notifiche' ? risposta({ data: [delContatto], workspace: 'acme-marketing' }) : daAccettare()));
        vi.stubGlobal('fetch', fetchFinto);
        const naviga = vi.fn();
        await mostra(<Cornice dati={diSempre} naviga={naviga} onLogout={esciSenzaEffetto} />);

        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif-list .zr-notif-item'));
        expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(['/cornice/notifiche', '/cornice/notifiche/uat-n69/lettura']);
        expect(naviga.mock.calls).toStrictEqual([['https://crm.zeiras.com/w/acme-marketing/contatti/uat-persona-1']]);
        expect(cornice()).toStrictEqual(ridotta);
    });

    it('`accettazione_richiesta: false` vale come assente, e senza la chiave e senza il segnale l\'`AppShell` riceve le prop di prima: né una in più né una in meno (sprint 24 · T2.6)', async () => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        const date = async (deiDati: DatiDellaCornice) => {
            await mostra(<Cornice dati={deiDati} product="pm" flush onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>);

            return (appShell.mock.lastCall?.[0] ?? {}) as Record<string, unknown>;
        };
        /** Una prop senza le sue funzioni, che a ogni render sono altre: conta che ci siano. La pagina (`children`) si guarda nel DOM. */
        const valori = (valore: unknown): unknown => (typeof valore === 'function' ? 'una funzione' : Array.isArray(valore) ? valore.map(valori) : valore !== null && typeof valore === 'object' ? Object.fromEntries(Object.entries(valore).map(([nome, suo]) => [nome, valori(suo)])) : valore);
        const senzaLaPagina = (props: Record<string, unknown>) => valori(Object.fromEntries(Object.entries(props).filter(([nome]) => nome !== 'children')));

        const senza = await date(diSempre);
        // Le prop che la cornice dà all'`AppShell` a una pagina così, com'erano nella `v1.13.0`.
        expect(Object.keys(senza).sort()).toStrictEqual([
            'accountItems', 'children', 'companies', 'email', 'flush', 'labels', 'nav', 'notifications', 'notificationsState', 'onAccount', 'onAllNotifications', 'onNotificationsOpen',
            'onOpenNotification', 'onRetryNotifications', 'onSearch', 'onSelectResult', 'onSelectWorkspace', 'product', 'searchResults', 'searchState', 'settingsHref', 'unreadCount', 'user', 'workspace', 'workspaceSlug',
        ]);
        expect([senza.product, senza.flush, senza.unreadCount, senza.notificationsState, senza.searchState]).toStrictEqual(['pm', true, 7, 'ready', 'ready']);
        expect([avviso(), uno('main')?.textContent]).toStrictEqual([null, 'La pagina']);

        const conFalse = await date({ ...diSempre, accettazione_richiesta: false });
        expect(senzaLaPagina(conFalse)).toStrictEqual(senzaLaPagina(senza));
        expect([avviso(), uno('main')?.textContent, uno('.zr-bell-count')?.textContent]).toStrictEqual([null, 'La pagina', '7']);
    });

    // Sprint 25 · T5 (voce #1762): i minori della seconda lettura della PR #52.

    /** Una pagina con uno stato suo: un campo, un riquadro che scorre, e un effetto che parte a ogni montaggio. */
    function PaginaConUnCampo({ montata }: { montata: () => void }) {
        useEffect(montata, [montata]);

        return <form><input name="bozza" /><div className="uat-scorre" /></form>;
    }
    /** Dati di sempre letti dopo: il loro segno è più avanti di quello di `diSempre` e di `ridotti`. */
    const lettiDopo: DatiDellaCornice = { ...diSempre, aggiornati_il: '2026-10-11T22:00:05.000001Z' };

    // T5.1 (S1, e ciò che restava di R2). L'avviso entra sopra la pagina e la pagina resta dov'è — qui, senza percorso, figlia
    // diretta di `main.zr-main` — com'è fuori dallo stato ridotto: quando lo stato arriva o se ne va non si rimonta. Ciò che la persona ha scritto in un
    // campo resta, col fuoco e con lo scorrimento, e gli effetti della pagina non ripartono. Lo stato arriva in due modi: coi
    // dati di una visita che tiene la pagina montata, o dal 403 di una rotta.
    it.each<[string, boolean]>([
        ['arriva coi dati di una visita che tiene la pagina montata', false],
        ['arriva dal 403 di una rotta', true],
    ])('quando lo stato ridotto %s, e quando se ne va, la pagina non si rimonta: il campo è lo stesso nodo, con ciò che c\'era scritto, col fuoco e con lo scorrimento, e il suo effetto non riparte (sprint 25 · T5.1)', async (_come, daUnaRotta) => {
        const elenco = inAttesa();
        vi.stubGlobal('fetch', vi.fn(() => elenco.promessa));
        const montata = vi.fn();
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" flush onLogout={esciSenzaEffetto}><PaginaConUnCampo montata={montata} /></Cornice>;
        await mostra(laPagina(diSempre));
        const campo = uno('main input') as HTMLInputElement;
        const riquadro = uno('main .uat-scorre') as HTMLElement;
        campo.value = 'una bozza';
        riquadro.scrollTop = 40;
        /** Ciò che una pagina rimontata perderebbe, e dove sta la pagina: senza percorso, figlia diretta di `main.zr-main`. */
        const dellaPagina = () => ({
            campo: uno('main input') === campo,
            scritto: (uno('main input') as HTMLInputElement | null)?.value,
            colFuoco: document.activeElement === campo,
            scorrimento: uno('main .uat-scorre')?.scrollTop,
            montaggi: montata.mock.calls.length,
            figliaDiMain: uno('main form')?.parentElement === uno('main'),
        });
        const comEra = { campo: true, scritto: 'una bozza', colFuoco: true, scorrimento: 40, montaggi: 1, figliaDiMain: true };

        if (daUnaRotta) {
            await clic(uno('.zr-bell'));
        }
        campo.focus();
        expect([diSempreInPagina(), dellaPagina()]).toStrictEqual([[true, '7', null], comEra]);

        // Lo stato ridotto arriva.
        await (daUnaRotta ? elenco.arriva(daAccettare()) : mostra(laPagina(ridotti)));
        expect([cornice(), dellaPagina()]).toStrictEqual([ridotta, comEra]);
        // L'avviso sta prima della pagina, in un contenitore suo.
        expect([...(uno('main')?.children ?? [])].map((figlio) => [figlio.tagName, figlio.querySelector('.zr-alert') !== null])).toStrictEqual([['DIV', true], ['FORM', false]]);
        // Lo spazio fra avviso e pagina è quello di `zr-stack`, fra l'avviso e un secondo figlio vuoto.
        const delAvviso = uno('main > div');
        expect([delAvviso?.className, delAvviso?.children.length, delAvviso?.firstElementChild === avviso(), delAvviso?.lastElementChild?.childNodes.length]).toStrictEqual(['zr-stack', 2, true, 0]);

        // E se ne va, coi dati letti dopo che non lo dicono.
        await mostra(laPagina(lettiDopo));
        expect([diSempreInPagina(), dellaPagina()]).toStrictEqual([[true, '7', null], comEra]);
    });

    // Lettura della PR #56, R5 e R6. Dove sta la pagina: dentro `main.zr-main`, o dentro `div.zr-main-body` se ha il percorso (è
    // lì che l'`AppShell` mette `children`). In tutti e due i posti l'avviso le sta subito prima, e la pagina non si rimonta. E
    // ciò che la cornice dà all'`AppShell` come `children` è sempre un frammento, anche fuori dallo stato ridotto: il primo
    // figlio è l'avviso, o niente; il secondo è la pagina, com'è. Nella tupla `dove` viene prima delle briciole: vitest riempie i
    // `%s` del titolo in ordine, e il secondo deve dire dove sta la pagina (letture della PR #56, N5).
    it.each<[string, string, { label: string }[] | undefined]>([
        ['senza percorso', 'main.zr-main', undefined],
        ['col percorso', 'main.zr-main > div.zr-main-body', [{ label: 'UAT Lancio' }, { label: 'UAT Scheda' }]],
    ])('%s la pagina sta in `%s`, nello stato ridotto con l\'avviso subito prima, e non si rimonta; `children` dell\'`AppShell` è sempre un frammento con la pagina per secondo figlio (sprint 25 · T6, R5 e R6)', async (_caso, dove, crumbs) => {
        const appShell = vi.spyOn(componenti, 'AppShell');
        const montata = vi.fn();
        const pagina = <PaginaConUnCampo montata={montata} />;
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" crumbs={crumbs} onLogout={esciSenzaEffetto}>{pagina}</Cornice>;
        /** Dove sta la pagina, che cosa ha accanto, e ciò che l'`AppShell` ha ricevuto come `children`. */
        const dellaPagina = () => {
            const dato = appShell.mock.lastCall?.[0].children as ReactElement<{ children: unknown[] }>;

            return {
                padre: uno('main form')?.parentElement === uno(dove),
                accanto: [...(uno(dove)?.children ?? [])].map((figlio) => [figlio.tagName, figlio.querySelector('.zr-alert') !== null]),
                frammento: dato.type === Fragment,
                figli: dato.props.children.length,
                senzaAvviso: dato.props.children[0] === null,
                laPagina: dato.props.children[1] === pagina,
                montaggi: montata.mock.calls.length,
            };
        };

        await mostra(laPagina(diSempre));
        const campo = uno('main input');
        expect(dellaPagina()).toStrictEqual({ padre: true, accanto: [['FORM', false]], frammento: true, figli: 2, senzaAvviso: true, laPagina: true, montaggi: 1 });

        // Lo stato ridotto arriva: l'avviso entra subito prima della pagina, nello stesso posto.
        await mostra(laPagina(ridotti));
        expect(dellaPagina()).toStrictEqual({ padre: true, accanto: [['DIV', true], ['FORM', false]], frammento: true, figli: 2, senzaAvviso: false, laPagina: true, montaggi: 1 });
        expect(uno('main input')).toBe(campo);

        // E se ne va.
        await mostra(laPagina(lettiDopo));
        expect(dellaPagina()).toStrictEqual({ padre: true, accanto: [['FORM', false]], frammento: true, figli: 2, senzaAvviso: true, laPagina: true, montaggi: 1 });
        expect(uno('main input')).toBe(campo);
    });

    // T5.3 (S3). Il segnale di una rotta vale per i dati dello stesso workspace che non sono più recenti: non per quelli di un
    // altro workspace, nemmeno con lo stesso segno, e senza segno solo per lo stesso oggetto.
    it.each<[string, DatiDellaCornice, (deiDati: DatiDellaCornice) => DatiDellaCornice]>([
        ['dati di un altro workspace con lo stesso segno', diSempre, (deiDati) => ({ ...deiDati, workspace: { nome: 'Vendite', slug: 'acme-vendite' } })],
        ['un altro oggetto senza segno', { ...dati, aziende, non_lette: 7 }, (deiDati) => ({ ...deiDati })],
    ])('dopo il 403 `accettazione_richiesta` di una rotta, con %s la cornice torna quella di sempre (sprint 25 · T5.3)', async (_caso, primi, altri) => {
        vi.stubGlobal('fetch', vi.fn(async () => daAccettare()));
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>;
        await mostra(laPagina(primi));
        await clic(uno('.zr-bell'));
        expect(cornice()).toStrictEqual(ridotta);
        // Con lo stesso oggetto resta ridotta.
        await mostra(laPagina(primi));
        expect(cornice()).toStrictEqual(ridotta);

        await mostra(laPagina(altri(primi)));
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);
    });

    // T5.3 (S4). Un frontend può tenere la `Cornice` montata fra due workspace, senza la `key` del layout. Il segnale di A non
    // vale in B, e non torna a valere in A: la prima volta che non vale per i dati della cornice si toglie. Altrimenti, tornati
    // in A coi dati di prima (Indietro del browser), la cornice uscirebbe ridotta per un segnale vecchio a chi nel frattempo ha
    // accettato. Se in A serve ancora, lo ridice la prima rotta che risponde.
    it.each<[string, (deiDati: DatiDellaCornice) => DatiDellaCornice]>([
        ['lo stesso oggetto', (deiDati) => deiDati],
        ['una copia con lo stesso segno', (deiDati) => ({ ...deiDati })],
    ])('con la cornice tenuta montata fra due workspace il segnale di una rotta non resta: A col 403, poi B, poi di nuovo A coi dati di prima (%s), e la cornice non esce ridotta per un segnale vecchio (sprint 25 · T5.3)', async (_quali, diPrima) => {
        const fetchFinto = vi.fn(async () => daAccettare());
        vi.stubGlobal('fetch', fetchFinto);
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>;
        await mostra(laPagina(diSempre));
        await clic(uno('.zr-bell'));
        expect(cornice()).toStrictEqual(ridotta);

        // In B il segnale di A non vale.
        await mostra(laPagina({ ...diSempre, workspace: { nome: 'Vendite', slug: 'acme-vendite' } }));
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);
        // Di nuovo in A, coi dati di prima.
        await mostra(laPagina(diPrima(diSempre)));
        expect(diSempreInPagina()).toStrictEqual([true, '7', null]);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    // T5.8 (A8), l'avviso per il lettore di schermo. Ciò che la cornice ha detto nel suo `role="status"` nascosto — il numero
    // sceso dopo una lettura con un clic — nello stato ridotto non resta: la campanella non ha più un numero, e la zona non
    // continua a dirne uno. Il numero può non cambiare: col 403 di una rotta i dati sono gli stessi, e i dati ridotti contano
    // zero come chi ha appena letto l'ultima.
    it.each<[string, number, string, boolean]>([
        ['dal 403 di una rotta, coi dati di prima', 7, 'Notifiche, 6 non lette', true],
        ['coi dati ridotti, che contano zero come l\'avviso', 1, 'Nessuna notifica non letta', false],
    ])('un avviso già detto al lettore di schermo non resta nel `role="status"` nascosto quando lo stato ridotto arriva %s (sprint 25 · T5.8)', async (_come, nonLette, dettoPrima, daUnaRotta) => {
        const delContatto = { id: 'uat-n69', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } };
        let caricamenti = 0;
        const fetchFinto = vi.fn(async (indirizzo: string) => {
            if (indirizzo === '/cornice/notifiche') {
                return ++caricamenti === 1 ? risposta({ data: [delContatto], workspace: 'acme-marketing' }) : daAccettare();
            }

            return risposta({ data: { id: 'uat-n69', letta: true } });
        });
        vi.stubGlobal('fetch', fetchFinto);
        const detto = () => [...contenitore.children].find((figlio) => figlio.getAttribute('role') === 'status')?.textContent;
        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} naviga={vi.fn()} onLogout={esciSenzaEffetto} />;
        const conQuelNumero = { ...diSempre, non_lette: nonLette };
        await mostra(laPagina(conQuelNumero));
        await clic(uno('.zr-bell'));
        await clic(uno('.zr-notif-list .zr-notif-item'));
        expect(detto()).toBe(dettoPrima);

        await (daUnaRotta ? clic(uno('.zr-bell')) : mostra(laPagina(ridotti)));
        expect(cornice()).toStrictEqual(ridotta);
        expect(detto()).toBe('');
    });

    // T5.8 (A8), la ricerca. L'`AppShell` aspetta 300 ms dall'ultimo tasto e poi chiama la `onSearch` che aveva al tasto: se nel
    // mezzo la cornice è passata allo stato ridotto, quella chiamata non fa partire una `POST /cornice/ricerca`.
    describe('i 300 ms che l\'`AppShell` aspetta dopo l\'ultimo tasto', () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        const laPagina = (deiDati: DatiDellaCornice) => <Cornice dati={deiDati} product="pm" onLogout={esciSenzaEffetto}><p>La pagina</p></Cornice>;
        /** Scrive nel campo della ricerca, come una persona, e lascia passare quei millisecondi. */
        const batte = async (parola: string, poi: number) => {
            const campo = uno('.zr-search input') as HTMLInputElement;
            await act(async () => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, parola);
                campo.dispatchEvent(new Event('input', { bubbles: true }));
                await vi.advanceTimersByTimeAsync(poi);
            });
        };
        const passano = async (millisecondi: number) => act(async () => {
            await vi.advanceTimersByTimeAsync(millisecondi);
        });

        it.each<[string, DatiDellaCornice, string[]]>([
            ['arrivano i dati ridotti: la ricerca non parte', ridotti, []],
            // Il controllo vede ciò che cerca: con altri dati di sempre, dopo gli stessi tasti, la ricerca parte.
            ['arrivano altri dati di sempre: la ricerca parte', lettiDopo, ['/cornice/ricerca']],
        ])('fra l\'ultimo tasto e i 300 ms %s (sprint 25 · T5.8)', async (_caso, arrivati, partite) => {
            const fetchFinto = vi.fn(async (_indirizzo: string) => risposta({ data: [], workspace: 'acme-marketing' }));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(laPagina(diSempre));
            await batte('uat', 100);
            await mostra(laPagina(arrivati));
            await passano(300);

            expect(fetchFinto.mock.calls.map(([indirizzo]) => indirizzo)).toStrictEqual(partite);
        });

        it('se lo stato ridotto lo dice il 403 di una ricerca in volo, il tasto battuto nel frattempo non ne fa partire un\'altra (sprint 25 · T5.8)', async () => {
            let arriva!: (valore: Response) => void;
            const fetchFinto = vi.fn((_indirizzo: string) => new Promise<Response>((risolvi) => (arriva = risolvi)));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(laPagina(diSempre));
            // La prima ricerca parte, e resta in volo.
            await batte('ua', 300);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
            // Un altro tasto: l'`AppShell` aspetta i suoi 300 ms. Dopo 100 arriva il 403.
            await batte('uat', 100);
            await act(async () => {
                arriva(daAccettare());
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(cornice()).toStrictEqual(ridotta);

            await passano(300);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        // Sprint 26 · T4.1 (lettura della PR #56, R7). Passata allo stato ridotto la cornice dimentica la ricerca: tornata quella di
        // sempre non mostra i risultati di prima sotto una parola che non ha mai cercato, e la risposta di una richiesta che era in
        // volo non li rimette. La ricerca è pronta e vuota finché la persona non cerca di nuovo.
        /** Ciò che la ricerca mostra: i titoli dei risultati, se sta cercando, se ha un errore. */
        const laRicerca = () => ({
            risultati: tutti('.zr-search-panel [role="option"]').map((riga) => riga.querySelector('.zr-search-title')?.textContent),
            staCercando: uno('.zr-search-panel [role="status"] .zr-visually-hidden')?.textContent ?? null,
            errore: uno('.zr-search-panel [role="alert"]')?.textContent ?? null,
        });
        const prontaEVuota = { risultati: [], staCercando: null, errore: null };
        // Lettura della PR #59, R4. Con la ricerca pronta e vuota e una parola rimasta nel campo, sotto il campo l'`AppShell` scrive
        // «Nessun risultato» per quella parola, che la cornice non ha cercato: lo dice il README, ed è chiesto al design system
        // (un campo che si svuota). Il giorno che cambia, questi casi sono rossi e la frase del README si riscrive.
        const nessunRisultatoPer = (parola: string) => [`Nessun risultato per «${parola}»Prova con un'altra parola o controlla di essere nel workspace giusto.`];
        /** Ciò che si legge sotto il campo quando non ci sono righe di risultati. */
        const sottoIlCampo = () => tutti('.zr-search-note').map((nota) => nota.textContent);
        const trovato = (parola: unknown) => risposta({ data: [{ tipo: 'board.board', id: 'uat-1', titolo: `Risultato di «${String(parola)}»` }], workspace: 'acme-marketing' });
        const parolaDi = (opzioni?: RequestInit) => (JSON.parse(String(opzioni?.body)) as { q?: unknown }).q;

        it.each<[string, DatiDellaCornice, { risultati: string[]; staCercando: string | null; errore: string | null }, unknown[], string[]]>([
            ['arrivano i dati ridotti: tornata quella di sempre, la ricerca è pronta e vuota, e la parola nuova non è partita', ridotti, prontaEVuota, ['ua'], nessunRisultatoPer('uat')],
            // Il controllo vede ciò che cerca: con altri dati di sempre, dopo gli stessi tasti, la parola nuova parte e si vedono i suoi risultati.
            ['arrivano altri dati di sempre: la parola nuova parte, e i risultati sono i suoi', { ...diSempre, aggiornati_il: '2026-10-11T22:00:03.000001Z' }, { ...prontaEVuota, risultati: ['Risultato di «uat»'] }, ['ua', 'uat'], []],
        ])('coi risultati di una parola in pagina, fra il tasto di un\'altra e i 300 ms %s (sprint 26 · T4.1)', async (_caso, arrivati, attesa, parole, sotto) => {
            const fetchFinto = vi.fn(async (_indirizzo: string, opzioni?: RequestInit) => trovato(parolaDi(opzioni)));
            vi.stubGlobal('fetch', fetchFinto);
            await mostra(laPagina(diSempre));
            await batte('ua', 300);
            expect(laRicerca()).toStrictEqual({ ...prontaEVuota, risultati: ['Risultato di «ua»'] });

            await batte('uat', 100);
            await mostra(laPagina(arrivati));
            await passano(300);
            await mostra(laPagina(lettiDopo));

            expect(cornice()).not.toStrictEqual(ridotta);
            expect(fetchFinto.mock.calls.map(([, opzioni]) => parolaDi(opzioni))).toStrictEqual(parole);
            expect(laRicerca()).toStrictEqual(attesa);
            expect(sottoIlCampo()).toStrictEqual(sotto);
        });

        it.each<[string, boolean]>([
            ['arriva mentre la cornice è ridotta', true],
            ['arriva dopo che la cornice è tornata quella di sempre', false],
        ])('se la cornice passa allo stato ridotto con una ricerca in volo, la richiesta è annullata e la sua risposta non entra nella ricerca nemmeno se %s: tornata quella di sempre, la ricerca è pronta e vuota (sprint 26 · T4.1)', async (_caso, mentreERidotta) => {
            let arriva!: (valore: Response) => void;
            const fetchFinto = vi.fn((_indirizzo: string, _opzioni?: RequestInit) => new Promise<Response>((risolvi) => (arriva = risolvi)));
            vi.stubGlobal('fetch', fetchFinto);
            // La risposta arriva lo stesso, anche a richiesta annullata: è il caso peggiore.
            const risponde = async () => act(async () => {
                arriva(trovato('ua'));
                await vi.advanceTimersByTimeAsync(0);
            });
            await mostra(laPagina(diSempre));
            await batte('ua', 300);
            expect(laRicerca()).toStrictEqual({ ...prontaEVuota, staCercando: 'Sto cercando…' });
            expect(fetchFinto.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);

            await mostra(laPagina(ridotti));
            expect(cornice()).toStrictEqual(ridotta);
            expect(fetchFinto.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
            if (mentreERidotta) {
                await risponde();
            }
            await mostra(laPagina(lettiDopo));
            if (!mentreERidotta) {
                await risponde();
            }

            expect(cornice()).not.toStrictEqual(ridotta);
            expect(laRicerca()).toStrictEqual(prontaEVuota);
            expect(sottoIlCampo()).toStrictEqual(nessunRisultatoPer('ua'));
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });
    });
});
