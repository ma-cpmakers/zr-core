import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { CorniceDelCliente, type CorniceDelClienteProps, type DatiDelCliente } from './cliente';
import { CorniceDelloStaff } from './staff';
import { testi } from './lingue';
import { nelWorkspace, registro } from './registro';
import * as rimedi from './rimedi';
import clienteInglese from '../lingue/cliente/en.json';
import clienteSpagnolo from '../lingue/cliente/es.json';
import clienteItaliano from '../lingue/cliente/it.json';

// Sprint 110 (voce #3319, Decisione 21687 di zr-pm-07, da zr-home #3317): la cornice di chi è solo cliente, per le pagine «Il mio
// spazio» di zr-home, coi dati di `Cornice::datiDelCliente()`. Il selettore «Come cliente › Il mio spazio», niente piano, il menu
// del profilo Profilo, Impostazioni, Esci; le voci della barra del modulo; la campanella vuota e la ricerca che non si vede.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // La cornice del cliente non chiama nessuna rotta (né /cornice/notifiche né /cornice/ricerca): una chiamata è un difetto.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('nessuna rotta'); }));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function mostra(elemento: ReactElement): Promise<void> {
    await act(async () => radice.render(elemento));
}

function uno(selettore: string): HTMLElement | null {
    return contenitore.querySelector<HTMLElement>(selettore);
}

function tutti(selettore: string): HTMLElement[] {
    return [...contenitore.querySelectorAll<HTMLElement>(selettore)];
}

async function clic(elemento: Element | null): Promise<void> {
    expect(elemento).not.toBeNull();
    await act(async () => (elemento as HTMLElement).click());
}

/** Le voci del menu del profilo aperto, nell'ordine: il testo, o `null` per una linea. */
function vociDelProfilo(): (string | null)[] {
    return tutti('.zr-profile-menu > [role="menuitem"], .zr-profile-menu > .zr-menu-sep').map((voce) => (voce.matches('.zr-menu-sep') ? null : voce.querySelector('.zr-menu-label')?.textContent ?? null));
}

const dashboard = registro.find((voce) => voce.id === 'home')!;
const persona = { nome: 'Marta Rossi', email: 'marta.rossi@example.com', impronta: 'a1b2c3' };
const dati: DatiDelCliente = { lingua: 'it', persona, aziende: [], aggiornati_il: '2026-11-06T09:00:00+00:00' };
const conAziende: DatiDelCliente = {
    ...dati,
    aziende: [{ id: 'az-1', nome: 'Studio Bianchi', workspace: [{ id: 'ws-1', nome: 'Clienti', slug: 'clienti' }, { id: 'ws-2', nome: 'Interni', slug: 'interni', colore: 'plum' }], nuovo_workspace: false }],
};
const nav = [{ group: 'Il mio spazio', items: [{ id: 'panoramica', label: 'Panoramica', icon: 'home' as const }, { id: 'appuntamenti', label: 'Appuntamenti', icon: 'calendar' as const }] }];
const esci = () => {};

describe('la cornice del cliente', () => {
    it('T2.1 il selettore dice «Come cliente › Il mio spazio», attivo; niente riquadro del piano; nome ed email nell\'avatar e nel menu del profilo', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci}><p>La pagina</p></CorniceDelCliente>);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe(clienteItaliano.personalGroup);
        expect(uno('.zr-ws-switch .zr-ws-name')?.textContent).toBe(clienteItaliano.personal);
        expect(uno('.zr-plan')).toBeNull();
        expect(uno('main')?.textContent).toBe('La pagina');
        expect(uno('.zr-avatar-btn')?.getAttribute('aria-label')).toBe(`${testi('it').account}: ${persona.nome}`);

        await clic(uno('.zr-ws-switch'));
        const loSpazio = tutti('.zr-ws-menu .zr-ws-item');
        expect(loSpazio.map((voce) => voce.textContent)).toEqual([clienteItaliano.personal]);
        expect(loSpazio[0]?.getAttribute('aria-current')).toBe('true');
        expect(uno('.zr-ws-menu .zr-ws-group-title')?.textContent).toBe(clienteItaliano.personalGroup);

        await clic(uno('.zr-avatar-btn'));
        expect(uno('.zr-profile-head > span:last-child')?.textContent).toBe(persona.nome + persona.email);
    });

    it('T2.1 il menu del profilo è Profilo, Impostazioni, una linea, Esci: le prime due alle pagine di app.zeiras.com, Esci a onLogout; niente Piano né Azienda', async () => {
        const naviga = vi.fn();
        const onLogout = vi.fn();
        await mostra(<CorniceDelCliente dati={dati} nav={nav} naviga={naviga} onLogout={onLogout} />);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toEqual([testi('it').profile, testi('it').accountSettings, null, testi('it').logout]);
        await clic(tutti('.zr-profile-menu > [role="menuitem"]')[0]!);
        expect(naviga).toHaveBeenLastCalledWith(dashboard.indirizzo + '/impostazioni/profilo');

        await clic(uno('.zr-avatar-btn'));
        await clic(tutti('.zr-profile-menu > [role="menuitem"]')[1]!);
        expect(naviga).toHaveBeenLastCalledWith(dashboard.indirizzo + '/impostazioni/preferenze');

        await clic(uno('.zr-avatar-btn'));
        await clic(tutti('.zr-profile-menu > [role="menuitem"]')[2]!);
        expect(onLogout).toHaveBeenCalledTimes(1);
        expect(naviga).toHaveBeenCalledTimes(2);
    });

    it('T2.2 nella barra solo le voci del modulo, con la sua voce attiva e il suo onNavigate; il percorso, le azioni e flush sono del modulo; niente menu Moduli', async () => {
        const onNavigate = vi.fn();
        await mostra(
            <CorniceDelCliente dati={dati} nav={nav} active="appuntamenti" onNavigate={onNavigate} crumbs={[{ label: 'Il mio spazio' }, { label: 'Appuntamenti' }]} actions={<button type="button">Azione del modulo</button>} flush onLogout={esci} />,
        );

        expect(tutti('.zr-nav .zr-nav-title').map((titolo) => titolo.textContent)).toEqual(['Il mio spazio']);
        expect(tutti('.zr-nav a.zr-nav-item').map((voce) => voce.textContent)).toEqual(['Panoramica', 'Appuntamenti']);
        expect(uno('.zr-nav a.zr-nav-item[aria-current="page"]')?.textContent).toBe('Appuntamenti');
        // Nessuna voce del registro: niente Dashboard, niente moduli, in nessuna lingua.
        const nomiDelRegistro = registro.flatMap((voce) => ['it', 'es', 'en'].map((lingua) => (testi(lingua) as unknown as Record<string, string>)[voce.id]));
        expect(tutti('.zr-nav a, .zr-nav button').map((voce) => voce.textContent).filter((testo) => nomiDelRegistro.includes(testo ?? ''))).toEqual([]);
        expect(uno('.zr-product-switch')).toBeNull();
        expect(tutti('.zr-shell-crumbs li, .zr-shell-crumbs a, .zr-shell-crumbs span').map((voce) => voce.textContent).join(' ')).toContain('Appuntamenti');
        expect(uno('.zr-top-actions')?.textContent).toContain('Azione del modulo');
        expect(uno('main')?.classList.contains('is-flush')).toBe(true);

        await clic(tutti('.zr-nav a.zr-nav-item')[0]!);
        expect(onNavigate).toHaveBeenCalledWith('panoramica');
    });

    it('T2.2 con active={null} nessuna voce è attiva', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} active={null} onLogout={esci} />);

        expect(uno('.zr-nav a.zr-nav-item[aria-current="page"]')).toBeNull();
    });

    it('T2.3 senza nuovoWorkspace in fondo al selettore non c\'è «Crea il tuo workspace»', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);

        await clic(uno('.zr-ws-switch'));
        expect(uno('.zr-ws-new')).toBeNull();
    });

    it('T2.3 con nuovoWorkspace «Crea il tuo workspace» in fondo al selettore porta a quell\'indirizzo', async () => {
        const naviga = vi.fn();
        await mostra(<CorniceDelCliente dati={dati} nav={nav} nuovoWorkspace="/spazio/nuovo-workspace" naviga={naviga} onLogout={esci} />);

        await clic(uno('.zr-ws-switch'));
        expect(uno('.zr-ws-new')?.textContent).toBe(clienteItaliano.firstWorkspace);
        await clic(uno('.zr-ws-new'));
        expect(naviga).toHaveBeenCalledWith('/spazio/nuovo-workspace');
    });

    it('T2.3 con le aziende in fondo al selettore c\'è un workspace nuovo solo se una di quelle lo permette (`nuovo_workspace`): a chi è solo membro no (revisione R5)', async () => {
        const naviga = vi.fn();
        await mostra(<CorniceDelCliente dati={conAziende} nav={nav} nuovoWorkspace="/spazio/nuovo-workspace" naviga={naviga} onLogout={esci} />);
        await clic(uno('.zr-ws-switch'));
        expect(uno('.zr-ws-new')).toBeNull();

        await mostra(<CorniceDelCliente key="permette" dati={{ ...conAziende, aziende: [{ ...conAziende.aziende[0]!, nuovo_workspace: true }] }} nav={nav} nuovoWorkspace="/spazio/nuovo-workspace" naviga={naviga} onLogout={esci} />);
        await clic(uno('.zr-ws-switch'));
        await clic(uno('.zr-ws-new'));
        expect(naviga).toHaveBeenCalledWith('/spazio/nuovo-workspace');
    });

    it('T2.3 con le aziende il selettore ha anche quelle, coi loro workspace e i loro toni; un workspace porta alla Dashboard di quel workspace; lo spazio resta attivo', async () => {
        const naviga = vi.fn();
        await mostra(<CorniceDelCliente dati={conAziende} nav={nav} naviga={naviga} onLogout={esci} />);

        expect(uno('.zr-ws-switch .zr-ws-name')?.textContent).toBe(clienteItaliano.personal);
        await clic(uno('.zr-ws-switch'));
        expect(tutti('.zr-ws-menu .zr-ws-group-title').map((titolo) => titolo.textContent)).toEqual([clienteItaliano.personalGroup, 'Studio Bianchi']);
        expect(tutti('.zr-ws-menu .zr-ws-item').map((voce) => voce.textContent)).toEqual([clienteItaliano.personal, 'Clienti', 'Interni']);
        expect(tutti('.zr-ws-menu .zr-ws-item[aria-current="true"]').map((voce) => voce.textContent)).toEqual([clienteItaliano.personal]);
        expect(tutti('.zr-ws-menu .zr-ws-item')[2]?.querySelector<HTMLElement>('.zr-ws-dot')?.style.background).toBe('var(--plum)');

        await clic(tutti('.zr-ws-menu .zr-ws-item')[2]!);
        expect(naviga).toHaveBeenCalledWith(nelWorkspace(dashboard.indirizzo, 'interni'));
    });

    it('T2.4 la campanella non ha numero e il pannello è vuoto, col testo del cliente; nessuna rotta della cornice', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);

        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')?.textContent).toContain(clienteItaliano.notificationsEmptyText);
        expect(tutti('.zr-notif li')).toEqual([]);
    });

    it('T2.4 la cornice ha la classe che nasconde il campo della ricerca, e scrivere nel campo non chiama niente', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);

        expect(uno('.zr-shell')?.classList.contains('zr-cornice-del-cliente')).toBe(true);
        const campo = uno('.zr-top .zr-search input') as HTMLInputElement;
        await act(async () => {
            campo.value = 'fattura';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(uno('.zr-search-panel [role="status"] .zr-visually-hidden')).toBeNull();
    });

    it('T2.4 Ctrl+K non apre la ricerca nascosta, che al telefono nasconderebbe campanella e profilo; smontata la cornice del cliente, Ctrl+K torna a chi c\'è', async () => {
        const ctrlK = () => act(async () => void document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })));
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);
        await ctrlK();
        expect(uno('.zr-search.is-open')).toBeNull();

        await mostra(<CorniceDelloStaff lingua="it" persona={persona} onLogout={esci} />);
        await ctrlK();
        expect(uno('.zr-search.is-open')).not.toBeNull();
    });

    it('T2.4 Ctrl+K dentro la pagina arriva a chi lo ascolta nella pagina (un editor che inserisce un link), e la ricerca resta chiusa (revisione R2)', async () => {
        const ascolto = vi.fn();
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci}><input id="nella-pagina" onKeyDown={ascolto} /></CorniceDelCliente>);

        await act(async () => void uno('#nella-pagina')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })));
        expect(ascolto).toHaveBeenCalledTimes(1);
        expect(uno('.zr-search.is-open')).toBeNull();
    });

    it('T2.4 il CSS del cliente nasconde il campo della ricerca solo dentro la cornice del cliente', () => {
        const foglio = readFileSync(resolve(process.cwd(), 'resources/css/cliente.css'), 'utf8');
        const regole = [...foglio.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selettore, dichiarazioni]) => [selettore!.trim(), dichiarazioni!.replace(/\s+/g, ' ').trim()]);

        // Dalla v4.13.1 anche campanella e profilo a destra: senza il campo, che spingeva, scivolavano a sinistra (CL.4 della UAT).
        expect(regole).toEqual([['.zr-cornice-del-cliente .zr-top .zr-search', 'display: none;'], ['.zr-cornice-del-cliente .zr-top-actions', 'margin-left: auto;']]);
    });

    it.each([
        ['it', clienteItaliano, 'it'],
        ['es', clienteSpagnolo, 'es'],
        ['en', clienteInglese, 'en'],
        ['es-AR', clienteSpagnolo, 'es'],
        // Una lingua che zr-core non ha: l'inglese, per il cliente come per la cornice.
        ['de', clienteInglese, 'en'],
    ])('T2.5 in %s i testi del cliente vengono dal loro file, il resto dalla cornice', async (lingua, delCliente, base) => {
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua }} nav={nav} nuovoWorkspace="/spazio/nuovo-workspace" onLogout={esci} />);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe(delCliente.personalGroup);
        expect(uno('.zr-ws-switch .zr-ws-name')?.textContent).toBe(delCliente.personal);
        expect(uno('.zr-ws-switch')?.getAttribute('aria-label')).toBe(`${testi(base).workspaceSwitch}: ${delCliente.personalGroup} › ${delCliente.personal}`);
        await clic(uno('.zr-ws-switch'));
        expect(uno('.zr-ws-new')?.textContent).toBe(delCliente.firstWorkspace);

        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')?.textContent).toContain(delCliente.notificationsEmptyText);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toEqual([testi(base).profile, testi(base).accountSettings, null, testi(base).logout]);
    });

    it('T2.5 i file del cliente hanno le stesse chiavi in ogni lingua, tutte piene, e nessuna è scritta nelle lingue della cornice', () => {
        const chiavi = Object.keys(clienteItaliano).sort();
        for (const file of [clienteSpagnolo, clienteInglese]) {
            expect(Object.keys(file).sort()).toEqual(chiavi);
            expect(Object.values(file).every((testo) => testo.trim() !== '')).toBe(true);
        }
        for (const lingua of ['it', 'es', 'en']) {
            const dellaCornice = Object.values(testi(lingua));
            for (const testo of Object.values({ it: clienteItaliano, es: clienteSpagnolo, en: clienteInglese }[lingua]!)) {
                expect(dellaCornice).not.toContain(testo);
            }
        }
    });

    it('T2.5 con persona.foto l\'avatar mostra la foto; senza, le iniziali', async () => {
        const foto = '/cornice/foto?v=2026-11-06T09%3A00%3A00.000000Z&p=marta';
        await mostra(<CorniceDelCliente dati={{ ...dati, persona: { ...persona, foto } }} nav={nav} onLogout={esci} />);
        expect(tutti('.zr-avatar-btn .zr-avatar-img').map((immagine) => immagine.getAttribute('src'))).toEqual([foto]);

        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);
        expect(tutti('.zr-avatar-btn .zr-avatar-img')).toEqual([]);
    });

    it('T2.6 è esportata dai due ingressi, coi tipi', () => {
        expect(dallIngresso.CorniceDelCliente).toBe(CorniceDelCliente);
        expect(dallIngressoDelleApp.CorniceDelCliente).toBe(CorniceDelCliente);
        expectTypeOf<dallIngresso.CorniceDelClienteProps>().toEqualTypeOf<CorniceDelClienteProps>();
        expectTypeOf<dallIngressoDelleApp.CorniceDelClienteProps>().toEqualTypeOf<CorniceDelClienteProps>();
        expectTypeOf<dallIngressoDelleApp.DatiDelCliente>().toEqualTypeOf<DatiDelCliente>();
        expectTypeOf<CorniceDelClienteProps['onLogout']>().toEqualTypeOf<() => void>();
        expectTypeOf<CorniceDelClienteProps['nuovoWorkspace']>().toEqualTypeOf<string | undefined>();
    });
});

describe('tastiera e salto della cornice del cliente', () => {
    it('«Salta al contenuto» sta prima della cornice e porta il fuoco al contenuto della pagina', async () => {
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua: 'es' }} nav={nav} onLogout={esci}><p>La pagina</p></CorniceDelCliente>);

        const salto = contenitore.firstElementChild?.querySelector('button');
        expect(salto?.textContent).toBe(testi('es').skipToContent);
        expect(contenitore.firstElementChild?.nextElementSibling?.classList.contains('zr-shell')).toBe(true);

        await clic(salto!);
        expect(document.activeElement).toBe(uno('main.zr-main'));
    });

    it('i rimedi di tastiera arrivano come per la Cornice: con la naviga del modulo e il nome dei risultati nella sua lingua', async () => {
        const via = vi.spyOn(rimedi, 'via');
        const naviga = vi.fn();
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua: 'en' }} nav={nav} naviga={naviga} onLogout={esci} />);
        await act(() => vi.dynamicImportSettled());

        expect(via).toHaveBeenCalledWith(naviga, testi('en').searchResults);
        // Il nome del contenuto e i clic sulla barra laterale sono dell'`AppShell` dalla `v4.17.0` (righe 30, 27 e 98): coi testi e la `naviga` della cornice.
        const voce = document.querySelector<HTMLAnchorElement>('.zr-shell > .zr-side a.zr-nav-item[href]:not([href="#"])')!;
        voce.setAttribute('href', `${location.origin}/uat`);
        await act(async () => voce.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
        expect([document.querySelector('.zr-shell > main')?.getAttribute('aria-label'), naviga.mock.calls]).toStrictEqual([testi('en').mainContent, [[`${location.origin}/uat`]]]);
    });
});
