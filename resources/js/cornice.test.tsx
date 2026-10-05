import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IconName } from '../zeiras/index';
import { Cornice, type PersonaDellaCornice } from './cornice';
import { testi } from './lingue';
import { Zeiras } from './zeiras';

// Sprint 1 · T6 (voce #1255). La `Cornice` resa in un DOM finto: il menu Prodotti dal registro con gli indirizzi del workspace,
// il pulsante del prodotto aperto, i testi della lingua, i dati della persona dove li mette il design system, e dove portano
// account, notifiche e workspace (linea guida 15, passi 8, 10 e 11).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const persona: PersonaDellaCornice = {
    nome: 'Ada Lovelace',
    email: 'ada@example.com',
    piano: 'Team',
    aziende: [
        { id: 'acme', name: 'Acme', workspaces: [{ slug: 'acme-marketing', name: 'Marketing', tone: 'plum' }, { slug: 'acme-sales', name: 'Sales' }] },
        { id: 'globex', name: 'Globex', workspaces: [{ slug: 'globex', name: 'Globex HQ' }] },
    ],
    workspace: 'acme-marketing',
    nonLette: 3,
};
const percorso = [{ label: 'Marketing', href: 'https://board.zeiras.com/w/acme-marketing' }, { label: 'Q4 launch' }];

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
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

describe('la Cornice', () => {
    it('senza product il menu Prodotti è esteso: Dashboard prima e attiva, i prodotti con lo slug del workspace, «Presto» senza indirizzo (T6.1)', async () => {
        await mostra(<Cornice lingua="it" persona={persona}><p>La pagina</p></Cornice>);

        const gruppo = uno('.zr-nav .zr-nav-group');
        expect(gruppo?.querySelector('.zr-nav-title')?.textContent).toBe('Prodotti');
        const voci = [...(gruppo?.querySelectorAll<HTMLAnchorElement>('a.zr-nav-item') ?? [])];
        const nomi = voci.map((voce) => voce.querySelector('.zr-nav-label')?.textContent);
        expect(nomi).toStrictEqual(['Dashboard', 'Project Management', 'CRM', 'Bookings', 'Report', 'Automazioni', 'Contenuti']);
        expect(voci[0].getAttribute('aria-current')).toBe('page');
        expect(voci.map((voce) => voce.getAttribute('href'))).toStrictEqual([
            'https://app.zeiras.com/w/acme-marketing',
            'https://board.zeiras.com/w/acme-marketing',
            'https://crm.zeiras.com/w/acme-marketing',
            'https://bookings.zeiras.com/w/acme-marketing',
            '#',
            '#',
            '#',
        ]);
        // «Presto»: la voce non porta da nessuna parte, è disattivata e lo dice.
        expect(voci.map((voce) => voce.getAttribute('aria-disabled'))).toStrictEqual([null, null, null, null, 'true', 'true', 'true']);
        expect(voci.map((voce) => voce.querySelector('.zr-nav-soon')?.textContent ?? null))
            .toStrictEqual([null, null, null, null, 'Presto', 'Presto', 'Presto']);
        const icone: IconName[] = ['grid', 'board', 'users', 'calendar', 'chart', 'bolt', 'sparkle'];
        expect(voci.map((voce) => voce.querySelector('path')?.getAttribute('d'))).toStrictEqual(icone.map(tracciatoDi));
        expect(uno('.zr-product-switch')).toBeNull();
        expect(uno('main')?.textContent).toBe('La pagina');
    });

    it('con product="bookings" il menu si chiude nel pulsante di Bookings, e sotto ci sono le voci del prodotto (T6.2)', async () => {
        const voci = [{ id: 'oggi', label: 'Oggi', icon: 'calendar' as const }, { id: 'risorse', label: 'Risorse', icon: 'users' as const }];
        await mostra(<Cornice lingua="it" persona={persona} product="bookings" active="oggi" nav={[{ group: 'Agenda', items: voci }]} />);

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
        expect(uno('.zr-product-menu a[aria-current="true"]')?.querySelector('.zr-nav-label')?.textContent).toBe('Bookings');
    });

    it.each(['es', 'en'])('con lingua="%s" ogni testo della cornice è in quella lingua: nessuno resta italiano (T6.3)', async (lingua) => {
        const attesi = testi(lingua);
        const appShell = vi.spyOn(Zeiras, 'AppShell');
        await mostra(
            <Cornice lingua={lingua} persona={persona} crumbs={percorso} create={[{ label: 'Board', icon: 'board' }]} onNewWorkspace={() => {}} />,
        );

        // I testi arrivano interi, e nessun alias che vincerebbe su `labels`.
        const props = appShell.mock.lastCall?.[0];
        expect(props?.labels).toStrictEqual(attesi);
        expect(props?.searchPlaceholder).toBeUndefined();
        expect(props?.createLabel).toBeUndefined();

        // Sidebar, selettore, ricerca, notifiche, menu del profilo, «+» e percorso, uno dopo l'altro: testo e attributi letti.
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

        for (const [chiave, italiano] of Object.entries(Zeiras.APPSHELL_LABELS)) {
            if (italiano !== attesi[chiave as keyof typeof attesi]) {
                expect(pagina, chiave).not.toMatch(frase(italiano));
            }
        }
        const raggiunti = [
            'soon', 'settings', 'planTitle', 'planText', 'nav', 'openMenu', 'create', 'workspaceSwitch', 'newWorkspace', 'search',
            'searchPlaceholder', 'searchHint', 'notifications', 'unread', 'forMe', 'all', 'seeAll', 'notificationsEmpty',
            'notificationsEmptyText', 'account', 'profile', 'accountSettings', 'plan', 'company', 'logout', 'crumbs', 'products',
            'dashboard',
        ] as const;
        for (const chiave of raggiunti) {
            expect(pagina, chiave).toMatch(frase(attesi[chiave]));
        }
    });

    it('i dati della persona compaiono dove li mette il design system: avatar, profilo, selettore, campanella, percorso (T6.4)', async () => {
        await mostra(<Cornice lingua="it" persona={persona} crumbs={percorso} />);

        expect(uno('.zr-avatar-btn .zr-avatar')?.getAttribute('aria-label')).toBe('Ada Lovelace');
        expect(uno('.zr-avatar-btn .zr-avatar')?.textContent).toBe('AL');
        expect(uno('.zr-ws-company')?.textContent).toBe('Acme');
        expect(uno('.zr-ws-name')?.textContent).toBe('Marketing');
        expect(uno('.zr-bell-count')?.textContent).toBe('3');
        expect(tutti('.zr-crumbs a, .zr-crumbs [aria-current]').map((voce) => voce.textContent)).toStrictEqual(['Marketing', 'Q4 launch']);

        await clic(uno('.zr-ws-switch'));
        expect(tutti('.zr-ws-group-title').map((titolo) => titolo.textContent)).toStrictEqual(['Acme', 'Globex']);
        expect(tutti('.zr-ws-item .zr-nav-label').map((voce) => voce.textContent)).toStrictEqual(['Marketing', 'Sales', 'Globex HQ']);
        expect(tutti('.zr-ws-item[aria-current="true"]').map((voce) => voce.textContent)).toStrictEqual(['Marketing']);

        await clic(uno('.zr-avatar-btn'));
        const testa = uno('.zr-profile-head');
        expect([...(testa?.querySelectorAll('.zr-profile-head > span:not(.zr-avatar) > *') ?? [])].map((riga) => riga.textContent))
            .toStrictEqual(['Ada Lovelace', 'ada@example.com', 'Team']);
    });

    it('account, impostazioni, notifiche e workspace portano su app.zeiras.com o al nuovo slug; «Esci» chiama il frontend (linea guida 15)', async () => {
        const naviga = vi.fn();
        const esci = vi.fn();
        await mostra(<Cornice lingua="it" persona={persona} product="bookings" naviga={naviga} onLogout={esci} />);

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
        await clic(uno('.zr-ws-switch'));
        await clic(tutti('.zr-ws-item').find((voce) => voce.textContent === 'Globex HQ') ?? null);
        expect(naviga.mock.calls).toStrictEqual([
            ['https://app.zeiras.com/impostazioni/profilo'],
            ['https://app.zeiras.com/impostazioni/preferenze'],
            ['https://app.zeiras.com/azienda/impostazioni/piano'],
            ['https://app.zeiras.com/azienda'],
            ['https://app.zeiras.com/notifiche'],
            ['https://bookings.zeiras.com/w/globex'],
        ]);

        await voceDelProfilo('Esci');
        expect(esci).toHaveBeenCalledOnce();
        expect(naviga).toHaveBeenCalledTimes(6);
    });
});
