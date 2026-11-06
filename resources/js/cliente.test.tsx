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
import clienteInglese from '../lingue/cliente/en.json';
import clienteSpagnolo from '../lingue/cliente/es.json';
import clienteItaliano from '../lingue/cliente/it.json';
import frasiItaliane from '../lingue/notifiche/it.json';
import { rigaConLeFrasi } from './campanella';

// Sprint 110 (voce #3319, Decisione 21687 di zr-pm-07, da zr-home #3317): la cornice di chi è solo cliente, per le pagine «Il mio
// spazio» di zr-home, coi dati di `Cornice::datiDelCliente()`. Il selettore «Come cliente › Il mio spazio», niente piano, il menu
// del profilo Profilo, Impostazioni, Esci; le voci della barra del modulo; la campanella vuota e la ricerca che non si vede.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement;
let radice: Root;
/** Il `fetch` di ogni caso che non sceglie le sue rotte: una chiamata è un difetto. */
let nessunaRotta: ReturnType<typeof vi.fn>;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // La cornice del cliente non chiama nessuna rotta (né /cornice/notifiche né /cornice/ricerca): una chiamata è un difetto.
    // Dalla `v4.24.0` (sprint 116 · T3) la campanella chiama le rotte del cliente all'apertura: i suoi casi hanno le loro.
    nessunaRotta = vi.fn(async () => { throw new Error('nessuna rotta'); });
    vi.stubGlobal('fetch', nessunaRotta);
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    expect(nessunaRotta).not.toHaveBeenCalled();
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

    // Fino alla `v4.23` la campanella era vuota e non chiamava niente; dalla `v4.24.0` (sprint 116 · T3) apre le notifiche da
    // cliente: qui senza `non_lette` e senza notifiche, e i casi suoi sono in fondo.
    it('T2.4 senza `non_lette` la campanella non ha numero, e senza notifiche il pannello ha il testo vuoto del cliente', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: [], persona: persona.email })));
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);

        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-bell'));
        await arrivate();
        expect(uno('.zr-notif')?.textContent).toContain(clienteItaliano.notificationsEmptyText);
        expect(tutti('.zr-notif li')).toEqual([]);
    });

    // Dalla `v4.18.0` la ricerca non c'è: `search={false}` dell'`AppShell` (richiesta 201, lotto 0518), senza la classe e il CSS di zr-core.
    it('T2.4 nella barra in alto non c\'è il campo della ricerca, né una classe della cornice sulla `zr-shell`; campanella e profilo ci sono', async () => {
        await mostra(<CorniceDelCliente dati={dati} nav={nav} onLogout={esci} />);

        expect([uno('.zr-top .zr-search'), uno('.zr-shell')?.className, tutti('.zr-top-actions > .zr-bell, .zr-top-actions > .zr-avatar-btn').length]).toStrictEqual([null, 'zr-shell', 2]);
    });

    it('T2.4 Ctrl+K non apre una ricerca, che non c\'è; smontata la cornice del cliente, Ctrl+K torna a chi c\'è', async () => {
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

    it('T2.4 il CSS del cliente è vuoto: resta perché chi lo importa non si rompa, fino alla prossima versione maggiore (v4.18.0)', () => {
        const foglio = readFileSync(resolve(process.cwd(), 'resources/css/cliente.css'), 'utf8');

        expect(foglio.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe('');
    });

    it.each([
        ['it', clienteItaliano, 'it'],
        ['es', clienteSpagnolo, 'es'],
        ['en', clienteInglese, 'en'],
        ['es-AR', clienteSpagnolo, 'es'],
        // Una lingua che zr-core non ha: l'inglese, per il cliente come per la cornice.
        ['de', clienteInglese, 'en'],
    ])('T2.5 in %s i testi del cliente vengono dal loro file, il resto dalla cornice', async (lingua, delCliente, base) => {
        // La campanella, dalla `v4.24.0`, chiede le notifiche da cliente: qui nessuna, e il pannello dice il testo vuoto del cliente.
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: [], persona: persona.email })));
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua }} nav={nav} nuovoWorkspace="/spazio/nuovo-workspace" onLogout={esci} />);

        expect(uno('.zr-ws-switch .zr-ws-company')?.textContent).toBe(delCliente.personalGroup);
        expect(uno('.zr-ws-switch .zr-ws-name')?.textContent).toBe(delCliente.personal);
        expect(uno('.zr-ws-switch')?.getAttribute('aria-label')).toBe(`${testi(base).workspaceSwitch}: ${delCliente.personalGroup} › ${delCliente.personal}`);
        await clic(uno('.zr-ws-switch'));
        expect(uno('.zr-ws-new')?.textContent).toBe(delCliente.firstWorkspace);

        await clic(uno('.zr-bell'));
        await arrivate();
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
    it('«Salta al contenuto» è il link dell\'`AppShell`, nella lingua della cornice, e porta il fuoco al contenuto della pagina', async () => {
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua: 'es' }} nav={nav} onLogout={esci}><p>La pagina</p></CorniceDelCliente>);

        const salto = uno('.zr-shell > a.zr-skip') as HTMLElement;
        expect([salto?.textContent, contenitore.firstElementChild?.classList.contains('zr-shell')]).toStrictEqual([testi('es').skipToContent, true]);

        await clic(salto);
        expect(document.activeElement).toBe(uno('main.zr-main'));
    });

    it('i rimedi di tastiera arrivano come per la Cornice, e i clic sulla barra passano dalla `naviga` del modulo', async () => {
        const naviga = vi.fn();
        await mostra(<CorniceDelCliente dati={{ ...dati, lingua: 'en' }} nav={nav} naviga={naviga} onLogout={esci} />);
        await act(() => vi.dynamicImportSettled());

        // Il nome del contenuto e i clic sulla barra laterale sono dell'`AppShell` dalla `v4.17.0` (righe 30, 27 e 98): coi testi e la `naviga` della cornice.
        const voce = document.querySelector<HTMLAnchorElement>('.zr-shell > .zr-side a.zr-nav-item[href]:not([href="#"])')!;
        voce.setAttribute('href', `${location.origin}/uat`);
        await act(async () => voce.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
        expect([document.querySelector('.zr-shell > main')?.getAttribute('aria-label'), naviga.mock.calls]).toStrictEqual([testi('en').mainContent, [[`${location.origin}/uat`]]]);
    });
});

function risposta(corpo: unknown, stato = 200): Response {
    return { ok: stato >= 200 && stato < 300, status: stato, headers: new Headers(), json: async () => corpo } as Response;
}

/** Le risposte già pronte, e il pezzo della campanella con le frasi, arrivano. */
async function arrivate(): Promise<void> {
    for (let giro = 0; giro < 3; giro++) {
        await act(async () => {
            await vi.dynamicImportSettled();
            await new Promise((fatto) => setTimeout(fatto, 0));
        });
    }
}

// Sprint 116 · T3 (voce 3398, Decisione 22367 di zr-pm-07): la campanella della cornice del cliente, con le notifiche da cliente
// delle rotte `/cornice/cliente/…` (T1), i titoli delle frasi e la destinazione in «Il mio spazio» (T2).
describe('la campanella del cliente (sprint 116 · T3)', () => {
    const adesso = Date.now();
    const confermata = {
        id: 'n-1', creata_il: new Date(adesso - 3 * 3_600_000).toISOString(), letta: false, app: 'bookings', tipo: 'bookings.cliente.prenotazione.confermata',
        autore_nome: null, risorsa_nome: 'Personal training', per_me: null, quando: { il: '2026-11-10T17:30:00Z', fuso: 'Europe/Rome' }, azienda: 'Palestra Fit Arezzo', ids: { id: 'pr-1' },
    };
    // La più recente, seconda nell'elenco: «Segna tutte come lette» arriva fino a lei.
    const promemoria = {
        id: 'n-2', creata_il: new Date(adesso - 60_000).toISOString(), letta: false, app: 'bookings', tipo: 'bookings.cliente.prenotazione.promemoria',
        autore_nome: null, risorsa_nome: null, per_me: null, quando: { il: '2026-11-11T08:00:00Z', fuso: 'Europe/Rome' }, azienda: null, ids: {},
    };
    const conNumero = (nonLette: number): DatiDelCliente => ({ ...dati, non_lette: nonLette });

    /** Le rotte del cliente: l'elenco, la lettura di una (riuscita) e «Segna tutte» (con `altre`). Ogni altra è un 404. */
    function rotte(elenco: unknown[], altre = false) {
        const finto = vi.fn(async (indirizzo: string, opzioni?: RequestInit) => {
            const metodo = opzioni?.method ?? 'GET';
            if (metodo === 'GET' && indirizzo === '/cornice/cliente/notifiche') {
                return risposta({ data: elenco, aggiornati_il: '2026-11-06T21:00:00.000000Z', persona: persona.email });
            }
            if (metodo === 'PATCH' && /^\/cornice\/cliente\/notifiche\/[^/]+\/lettura$/.test(indirizzo)) {
                return risposta({ data: { letta: true }, segnata_il: '2026-11-06T21:00:01.000000Z', persona: persona.email });
            }
            if (metodo === 'POST' && indirizzo === '/cornice/cliente/notifiche/letture') {
                return risposta({ data: { fino_a: JSON.parse(String(opzioni?.body)).fino_a, altre }, segnate_il: '2026-11-06T21:00:02.000000Z', persona: persona.email });
            }

            return risposta({ errore: 'non_trovato' }, 404);
        });
        vi.stubGlobal('fetch', finto);

        return finto;
    }

    const chiamate = (finto: ReturnType<typeof rotte>) => finto.mock.calls.map(([indirizzo, opzioni]) => `${opzioni?.method ?? 'GET'} ${indirizzo}`);

    async function aperta(finto: ReturnType<typeof rotte>, elemento: ReactElement): Promise<void> {
        await mostra(elemento);
        expect(finto).not.toHaveBeenCalled();
        await clic(uno('.zr-bell'));
        await arrivate();
    }

    it('T3.1 la campanella mostra `non_lette`, «99+» oltre 99, nessun numero a 0; nessuna rotta prima di aprirla', async () => {
        const finto = rotte([]);
        const numeri: (string | null)[] = [];
        for (const nonLette of [3, 99, 100, 0]) {
            await mostra(<CorniceDelCliente dati={conNumero(nonLette)} nav={nav} onLogout={esci} />);
            numeri.push(uno('.zr-bell-count')?.textContent ?? null);
        }

        expect(numeri).toStrictEqual(['3', '99', '99+', null]);
        expect(finto).not.toHaveBeenCalled();
    });

    it('T3.1 coi dati ridotti (`accettazione_richiesta`) la campanella non ha numero e aprirla non chiama niente', async () => {
        const finto = rotte([confermata]);
        await mostra(<CorniceDelCliente dati={{ ...conNumero(3), accettazione_richiesta: true }} nav={nav} onLogout={esci} />);

        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-bell'));
        await arrivate();
        expect(finto).not.toHaveBeenCalled();
    });

    it('T3.2 aperta, chiede GET /cornice/cliente/notifiche (mai /cornice/notifiche): titolo delle frasi, l\'azienda sotto, l\'ora, non lette', async () => {
        const finto = rotte([confermata, promemoria]);
        await aperta(finto, <CorniceDelCliente dati={conNumero(2)} nav={nav} onLogout={esci} />);

        expect(chiamate(finto)).toStrictEqual(['GET /cornice/cliente/notifiche']);
        const righe = tutti('.zr-notif li .zr-notif-item');
        expect(righe.map((riga) => [riga.querySelector('.zr-notif-title')?.textContent, riga.querySelector('.zr-notif-sub')?.textContent ?? null, riga.classList.contains('is-unread')])).toStrictEqual([
            [rigaConLeFrasi(frasiItaliane, confermata, 'it').titolo, 'Palestra Fit Arezzo', true],
            [rigaConLeFrasi(frasiItaliane, promemoria, 'it').titolo, null, true],
        ]);
        // Il servizio nel titolo quando c'è, mai «null» quando non c'è; l'ora, senza il nome di un prodotto di Zeiras.
        expect(righe[0]!.querySelector('.zr-notif-title')?.textContent).toContain('Personal training');
        expect(righe[1]!.querySelector('.zr-notif-title')?.textContent).not.toContain('null');
        expect(righe.map((riga) => riga.querySelector('.zr-notif-meta')?.textContent)).toStrictEqual(['3 h fa', '1 min fa']);
        // L'icona di Bookings, il calendario (design zr-account--il-mio-spazio, schermata 5).
        expect(righe.map((riga) => riga.querySelector('.zr-iconbox')?.className)).toStrictEqual(['zr-iconbox zr-iconbox-sm zr-label-sky', 'zr-iconbox zr-iconbox-sm zr-label-sky']);
    });

    it('T3.2 un errore della rotta è lo stato d\'errore del pannello, e «Riprova» chiede di nuovo', async () => {
        const finto = vi.fn(async () => risposta({ errore: 'backoffice_non_risponde' }, 502));
        vi.stubGlobal('fetch', finto);
        await mostra(<CorniceDelCliente dati={conNumero(1)} nav={nav} onLogout={esci} />);
        await clic(uno('.zr-bell'));
        await arrivate();

        expect(uno('.zr-notif [role="alert"]')?.textContent).toContain(testi('it').notificationsError);
        await clic([...contenitore.querySelectorAll('.zr-notif button')].find((pulsante) => pulsante.textContent === testi('it').retry) ?? null);
        await arrivate();
        expect(finto).toHaveBeenCalledTimes(2);
    });

    it('T3.3 il clic su una riga con l\'id la segna letta (PATCH del cliente) e apre la prenotazione in «Il mio spazio»; il numero scende', async () => {
        const finto = rotte([confermata, promemoria]);
        const naviga = vi.fn();
        await aperta(finto, <CorniceDelCliente dati={conNumero(2)} nav={nav} naviga={naviga} onLogout={esci} />);

        await clic(tutti('.zr-notif li .zr-notif-item')[0]!);
        await arrivate();
        expect(chiamate(finto)).toStrictEqual(['GET /cornice/cliente/notifiche', 'PATCH /cornice/cliente/notifiche/n-1/lettura']);
        expect(JSON.parse(String(finto.mock.calls[1]![1]?.body))).toStrictEqual({ letta: true });
        expect(naviga.mock.calls).toStrictEqual([[`${dashboard.indirizzo}/spazio/prenotazioni/pr-1`]]);
        expect(uno('.zr-bell-count')?.textContent).toBe('1');
    });

    it('T3.3 una riga senza l\'id (una notifica che il backoffice non dice da cliente) si segna letta e non apre niente', async () => {
        const finto = rotte([promemoria, { ...confermata, id: 'n-3', ids: {} }]);
        const naviga = vi.fn();
        await aperta(finto, <CorniceDelCliente dati={conNumero(2)} nav={nav} naviga={naviga} onLogout={esci} />);

        await clic(tutti('.zr-notif li .zr-notif-item')[1]!);
        await arrivate();
        expect(chiamate(finto)).toStrictEqual(['GET /cornice/cliente/notifiche', 'PATCH /cornice/cliente/notifiche/n-3/lettura']);
        expect(naviga).not.toHaveBeenCalled();
    });

    it('T3.4 «Segna tutte come lette» manda alla rotta del cliente `fino_a`, la più recente delle caricate; senza `altre` il numero va a 0', async () => {
        const finto = rotte([confermata, promemoria]);
        await aperta(finto, <CorniceDelCliente dati={conNumero(5)} nav={nav} onLogout={esci} />);

        await clic([...contenitore.querySelectorAll('.zr-notif button')].find((pulsante) => pulsante.textContent === testi('it').markAllRead) ?? null);
        await arrivate();
        expect(chiamate(finto)).toStrictEqual(['GET /cornice/cliente/notifiche', 'POST /cornice/cliente/notifiche/letture']);
        expect(JSON.parse(String(finto.mock.calls[1]![1]?.body))).toStrictEqual({ fino_a: promemoria.creata_il });
        expect([uno('.zr-bell-count'), tutti('.zr-notif li .zr-notif-item.is-unread')]).toStrictEqual([null, []]);
    });

    it('T3.4 con `altre` il numero resta, e l\'elenco si chiede di nuovo', async () => {
        const finto = rotte([confermata, promemoria], true);
        await aperta(finto, <CorniceDelCliente dati={conNumero(5)} nav={nav} onLogout={esci} />);

        await clic([...contenitore.querySelectorAll('.zr-notif button')].find((pulsante) => pulsante.textContent === testi('it').markAllRead) ?? null);
        await arrivate();
        expect(chiamate(finto)).toStrictEqual(['GET /cornice/cliente/notifiche', 'POST /cornice/cliente/notifiche/letture', 'GET /cornice/cliente/notifiche']);
        expect(uno('.zr-bell-count')?.textContent).toBe('5');
    });
});
