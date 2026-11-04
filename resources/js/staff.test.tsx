import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { CorniceDelloStaff, type CorniceDelloStaffProps } from './staff';
import { testi } from './lingue';
import { registro } from './registro';
import * as rimedi from './rimedi';
import type { ShellSearchResult } from '../zeiras/index';
import staffInglese from '../lingue/staff/en.json';
import staffSpagnolo from '../lingue/staff/es.json';
import staffItaliano from '../lingue/staff/it.json';

// Sprint 93 (voce #2944, Decisioni 19872 e 19904): la cornice dello staff, l'`AppShell` per zr-superadmin senza `Cornice::dati()`.
// Nome ed email dello staff, le voci della barra e del profilo date dal modulo, «Esci», la ricerca che chiama una funzione del
// modulo. Niente selettore di workspace, niente menu Moduli, niente notifiche.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // La cornice dello staff non chiama nessuna rotta: una chiamata è un difetto.
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

const staff = { nome: 'Martina Bianchi', email: 'martina@example.com' };
const nav = [{ group: 'Backoffice', items: [{ id: 'panoramica', label: 'Panoramica', icon: 'grid' as const }, { id: 'utenti', label: 'Utenti', icon: 'users' as const }] }];
const esci = () => {};

/** Le voci del menu del profilo aperto, nell'ordine: il testo, o `null` per una linea. */
function vociDelProfilo(): (string | null)[] {
    return tutti('.zr-profile-menu > [role="menuitem"], .zr-profile-menu > .zr-menu-sep').map((voce) => (voce.matches('.zr-menu-sep') ? null : voce.querySelector('.zr-menu-label')?.textContent ?? null));
}

describe('la cornice dello staff', () => {
    it('T1.1 nome ed email dello staff nell\'avatar e in cima al menu del profilo; nella barra solo le voci del modulo, in cima il testo dell\'area', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} onLogout={esci}><p>La pagina</p></CorniceDelloStaff>);

        expect(uno('.zr-avatar-btn')?.getAttribute('aria-label')).toBe(`${testi('it').account}: ${staff.nome}`);
        expect(tutti('.zr-nav .zr-nav-title').map((titolo) => titolo.textContent)).toEqual(['Backoffice']);
        expect(tutti('.zr-nav a.zr-nav-item').map((voce) => voce.textContent)).toEqual(['Panoramica', 'Utenti']);
        // Nessuna voce del registro: niente Dashboard, niente moduli, in nessuna lingua.
        const nomiDelRegistro = registro.flatMap((voce) => ['it', 'es', 'en'].map((lingua) => (testi(lingua) as unknown as Record<string, string>)[voce.id]));
        expect(tutti('.zr-side a, .zr-side button').map((voce) => voce.textContent).filter((testo) => nomiDelRegistro.includes(testo ?? ''))).toEqual([]);
        // Nessun selettore: il workspace è il testo dell'area.
        expect(uno('.zr-ws-switch, [aria-haspopup="listbox"]')).toBeNull();
        expect(uno('.zr-workspace')?.textContent).toBe(staffItaliano.area);
        expect(uno('main')?.textContent).toBe('La pagina');

        await clic(uno('.zr-avatar-btn'));
        expect(uno('.zr-profile-head > span:last-child')?.textContent).toBe(staff.nome + staff.email);
    });

    it('T1.2 il menu del profilo è le voci del modulo, una linea e «Esci dal backoffice», che chiama onLogout una volta', async () => {
        const onLogout = vi.fn();
        const voce = vi.fn();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} menu={[{ icon: 'user', label: 'Il mio accesso staff', onClick: voce }]} onLogout={onLogout} />);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toEqual(['Il mio accesso staff', null, 'Esci dal backoffice']);
        for (const diZrHome of [testi('it').profile, testi('it').accountSettings, testi('it').company, testi('it').plan]) {
            expect(vociDelProfilo()).not.toContain(diZrHome);
        }

        await clic(tutti('.zr-profile-menu [role="menuitem"]').at(-1)!);
        expect(onLogout).toHaveBeenCalledTimes(1);
        expect(voce).not.toHaveBeenCalled();
    });

    it('T1.2 senza voci del modulo il menu del profilo ha solo «Esci», senza linea', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} onLogout={esci} />);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toEqual(['Esci dal backoffice']);
    });

    it.each([
        ['it', staffItaliano, 'it'],
        ['es', staffSpagnolo, 'es'],
        ['en', staffInglese, 'en'],
        ['es-AR', staffSpagnolo, 'es'],
        // Una lingua che zr-core non ha: l'inglese, per lo staff come per la cornice.
        ['de', staffInglese, 'en'],
    ])('T1.3 in %s i testi dello staff vengono dal loro file, il resto dalla cornice', async (lingua, dellaLingua, base) => {
        const onNavigate = vi.fn();
        await mostra(<CorniceDelloStaff lingua={lingua} persona={staff} nav={nav} onNavigate={onNavigate} onLogout={esci} />);

        expect(uno('.zr-workspace')?.textContent).toBe(dellaLingua.area);
        const configurazione = tutti('.zr-side-foot .zr-nav-item')[0]!;
        expect(configurazione.textContent).toBe(dellaLingua.settings);
        expect(uno('.zr-plan strong')?.textContent).toBe(dellaLingua.planTitle);
        expect(uno('.zr-plan span')?.textContent).toBe(dellaLingua.planText);
        expect(uno('.zr-search input')?.getAttribute('placeholder')).toBe(dellaLingua.searchPlaceholder);
        // Il resto è della cornice, nella stessa lingua.
        expect(uno('.zr-search input')?.getAttribute('aria-label')).toBe(testi(base).search);

        await clic(configurazione);
        expect(onNavigate).toHaveBeenCalledWith('settings');

        // La campanella c'è, perché l'`AppShell` la disegna sempre, ma senza numero; il pannello è vuoto, col testo dello staff.
        expect(uno('.zr-bell-count')).toBeNull();
        await clic(uno('.zr-bell'));
        expect(uno('.zr-notif')?.textContent).toContain(dellaLingua.notificationsEmptyText);

        await clic(uno('.zr-avatar-btn'));
        expect(vociDelProfilo()).toEqual([dellaLingua.logout]);
    });

    // Sprint 105 (voce #2954): «Configurazione» è solo del Superadmin, e il modulo la toglie a chi non lo è.
    it('con configurazione={false} «Configurazione» non c\'è, né nella barra né nel cassetto; il riquadro dello staff resta (sprint 105, T1.1)', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} configurazione={false} onLogout={esci} />);

        expect(tutti('.zr-side-foot .zr-nav-item')).toEqual([]);
        expect(tutti('.zr-side a, .zr-side button').map((voce) => voce.textContent)).not.toContain(staffItaliano.settings);
        expect(uno('.zr-plan strong')?.textContent).toBe(staffItaliano.planTitle);

        // Il cassetto, sotto i 1024 px, è la stessa barra aperta dal pulsante del menu.
        await clic(uno(`.zr-top button[aria-label="${testi('it').openMenu}"]`));
        expect(tutti('.zr-side-foot .zr-nav-item')).toEqual([]);
        expect(tutti('.zr-side a, .zr-side button').map((voce) => voce.textContent)).not.toContain(staffItaliano.settings);
    });

    it.each([[undefined], [true]])('con configurazione=%s «Configurazione» c\'è, e il clic arriva a onNavigate come settings (sprint 105, T1.2)', async (configurazione) => {
        const onNavigate = vi.fn();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} onNavigate={onNavigate} {...(configurazione === undefined ? {} : { configurazione })} onLogout={esci} />);

        expect(tutti('.zr-side-foot .zr-nav-item').map((voce) => voce.textContent)).toEqual([staffItaliano.settings]);
        await clic(uno('.zr-side-foot .zr-nav-item'));
        expect(onNavigate).toHaveBeenCalledWith('settings');
    });

    it('T1.3 i file dello staff hanno le stesse chiavi in ogni lingua, tutte piene, e nessuna è scritta nelle lingue della cornice', async () => {
        const chiavi = Object.keys(staffItaliano).sort();
        for (const file of [staffSpagnolo, staffInglese]) {
            expect(Object.keys(file).sort()).toEqual(chiavi);
            expect(Object.values(file).every((testo) => testo.trim() !== '')).toBe(true);
        }
        // Nelle lingue della cornice, che stanno nell'ingresso, nessun testo dello staff.
        for (const lingua of ['it', 'es', 'en']) {
            const dellaCornice = Object.values(testi(lingua));
            for (const testo of Object.values({ it: staffItaliano, es: staffSpagnolo, en: staffInglese }[lingua]!)) {
                if (testo !== (testi(lingua) as unknown as Record<string, string>).settings) {
                    expect(dellaCornice).not.toContain(testo);
                }
            }
        }
    });

    it('T1.4 è esportata dai due ingressi, coi tipi', () => {
        expect(dallIngresso.CorniceDelloStaff).toBe(CorniceDelloStaff);
        expect(dallIngressoDelleApp.CorniceDelloStaff).toBe(CorniceDelloStaff);
        expectTypeOf<dallIngresso.CorniceDelloStaffProps>().toEqualTypeOf<CorniceDelloStaffProps>();
        expectTypeOf<dallIngressoDelleApp.CorniceDelloStaffProps>().toEqualTypeOf<CorniceDelloStaffProps>();
        expectTypeOf<CorniceDelloStaffProps['onLogout']>().toEqualTypeOf<() => void>();
    });
});

describe('la ricerca della cornice dello staff', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Scrive una parola nel campo della ricerca, come una persona, e lascia passare i 300 ms dopo cui l'`AppShell` chiama `onSearch`. */
    async function scrivi(parola: string): Promise<void> {
        const campo = uno('.zr-search input') as HTMLInputElement;
        await act(async () => {
            campo.focus();
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, parola);
            campo.dispatchEvent(new Event('input', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(300);
        });
    }

    /** Una risposta di `cerca` che arriva, o fallisce, quando il test lo dice. */
    function inAttesa() {
        let arriva!: (risultati: ShellSearchResult[]) => void;
        let fallisce!: (errore: unknown) => void;
        const promessa = new Promise<ShellSearchResult[]>((risolvi, rifiuta) => {
            arriva = risolvi;
            fallisce = rifiuta;
        });

        return {
            promessa,
            arriva: async (risultati: ShellSearchResult[]) => act(async () => { arriva(risultati); await vi.advanceTimersByTimeAsync(0); }),
            fallisce: async (errore: unknown) => act(async () => { fallisce(errore); await vi.advanceTimersByTimeAsync(0); }),
        };
    }

    const titoli = () => tutti('.zr-search-panel [role="option"]').map((riga) => riga.querySelector('.zr-search-title')?.textContent);
    const inCaricamento = () => uno('.zr-search-panel [role="status"] .zr-visually-hidden')?.textContent === testi('it').searchLoading;
    const anna: ShellSearchResult = { id: 'u1', title: 'Anna Ricci', subtitle: 'anna@example.com', group: 'Persone', icon: 'user', container: true, href: '/utenti/u1' };
    const clienti: ShellSearchResult = { id: 'w5', title: 'Clienti', subtitle: 'Acme', group: 'Workspace', icon: 'grid', container: true, href: '/workspace/w5' };

    it('T2.1 dal secondo carattere chiama cerca con la parola e un segnale, mostra il caricamento, poi i risultati; un risultato si apre con naviga', async () => {
        const risposta = inAttesa();
        const cerca = vi.fn((_parola: string, _segnale: AbortSignal) => risposta.promessa);
        const naviga = vi.fn();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} cerca={cerca} naviga={naviga} onLogout={esci} />);

        await scrivi('a');
        expect(cerca).not.toHaveBeenCalled();

        await scrivi('an');
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(cerca.mock.calls[0]![0]).toBe('an');
        expect(cerca.mock.calls[0]![1]).toBeInstanceOf(AbortSignal);
        expect(inCaricamento()).toBe(true);

        await risposta.arriva([anna, clienti]);
        expect(titoli()).toEqual(['Anna Ricci', 'Clienti']);

        await clic(tutti('.zr-search-panel [role="option"]')[1]!);
        expect(naviga).toHaveBeenCalledWith('/workspace/w5');
    });

    it('T2.1 a ogni tasto con due caratteri o più la ricerca è subito in caricamento: sotto la parola nuova non restano i risultati di prima', async () => {
        const prima = inAttesa();
        const seconda = inAttesa();
        const cerca = vi.fn((parola: string, _segnale: AbortSignal) => (parola === 'an' ? prima.promessa : seconda.promessa));
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);
        await scrivi('an');
        await prima.arriva([anna]);
        expect(titoli()).toEqual(['Anna Ricci']);

        // Il tasto, senza i 300 ms: l'`AppShell` non ha ancora chiamato la cornice.
        const campo = uno('.zr-search input') as HTMLInputElement;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, 'cl');
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(titoli()).toEqual([]);
        expect(inCaricamento()).toBe(true);
        expect(campo.value).toBe('cl');

        await act(() => vi.advanceTimersByTimeAsync(300));
        await seconda.arriva([clienti]);
        expect(titoli()).toEqual(['Clienti']);
    });

    it('T2.3 senza cerca, un tasto non mette il caricamento', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} onLogout={esci} />);
        const campo = uno('.zr-search input') as HTMLInputElement;
        await act(async () => {
            campo.focus();
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, 'anna');
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(inCaricamento()).toBe(false);
    });

    it('T2.2 una parola nuova annulla la richiesta di prima, e la sua risposta tardiva non entra', async () => {
        const prima = inAttesa();
        const seconda = inAttesa();
        const cerca = vi.fn((parola: string, _segnale: AbortSignal) => (parola === 'an' ? prima.promessa : seconda.promessa));
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);

        await scrivi('an');
        await scrivi('cli');
        expect(cerca.mock.calls[0]![1].aborted).toBe(true);
        expect(cerca.mock.calls[1]![1].aborted).toBe(false);

        await seconda.arriva([clienti]);
        await prima.arriva([anna]);
        expect(titoli()).toEqual(['Clienti']);
    });

    it('T2.2 smontata la cornice, la richiesta in volo è annullata', async () => {
        const risposta = inAttesa();
        const cerca = vi.fn((_parola: string, _segnale: AbortSignal) => risposta.promessa);
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);

        await scrivi('an');
        await act(async () => radice.render(<p>Altro</p>));
        expect(cerca.mock.calls[0]![1].aborted).toBe(true);
        await risposta.arriva([anna]);
    });

    it('T2.3 una cerca che rifiuta dà lo stato d\'errore; un annullo non cambia lo stato', async () => {
        const prima = inAttesa();
        const seconda = inAttesa();
        const cerca = vi.fn((parola: string, _segnale: AbortSignal) => (parola === 'an' ? prima.promessa : seconda.promessa));
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);

        await scrivi('an');
        await scrivi('cli');
        // La prima, annullata, rifiuta: la seconda resta in caricamento.
        await prima.fallisce(new DOMException('annullata', 'AbortError'));
        expect(inCaricamento()).toBe(true);

        await seconda.fallisce(new Error('429'));
        expect(uno('.zr-search-panel')?.textContent).toContain(testi('it').searchError);
    });

    it('T2.3 senza cerca il campo non chiama niente e non resta in caricamento', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} onLogout={esci} />);

        await scrivi('anna');
        expect(inCaricamento()).toBe(false);
        expect(uno('.zr-search-panel')?.textContent).not.toContain(testi('it').searchError);
        // Senza `cerca` non c'è niente da trovare: il pannello lo dice, per la parola che c'è.
        expect(uno('.zr-search-panel [role="status"] strong')?.textContent).toBe(`${testi('it').searchEmpty} «anna»`);
    });

    it('T2.3 una cerca che lancia invece di rifiutare dà lo stato d\'errore, non un caricamento che non finisce (revisione dello sprint 93, R2)', async () => {
        const cerca = vi.fn((_parola: string, _segnale: AbortSignal): Promise<ShellSearchResult[]> => {
            throw new Error('rotta');
        });
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);

        await scrivi('an');
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(inCaricamento()).toBe(false);
        expect(uno('.zr-search-panel')?.textContent).toContain(testi('it').searchError);
    });

    it('T2.3 una cerca tolta dal modulo fra il tasto e la chiamata non parte, e la ricerca non resta in caricamento (revisione dello sprint 93, R3)', async () => {
        const cerca = vi.fn((_parola: string, _segnale: AbortSignal) => Promise.resolve([anna]));
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);
        const campo = uno('.zr-search input') as HTMLInputElement;
        await act(async () => {
            campo.focus();
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, 'an');
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(inCaricamento()).toBe(true);

        await mostra(<CorniceDelloStaff lingua="it" persona={staff} onLogout={esci} />);
        await act(() => vi.advanceTimersByTimeAsync(300));
        expect(cerca).not.toHaveBeenCalled();
        expect(inCaricamento()).toBe(false);
        expect(uno('.zr-search-panel')?.textContent).not.toContain(testi('it').searchError);
    });

    it.each([
        ['it', staffItaliano],
        ['es', staffSpagnolo],
        ['en', staffInglese],
    ])('T1.3 in %s l\'invito e il testo del vuoto della ricerca sono quelli dello staff (revisione dello sprint 93, R5)', async (lingua, dellaLingua) => {
        await mostra(<CorniceDelloStaff lingua={lingua} persona={staff} cerca={async () => []} onLogout={esci} />);

        await scrivi('a');
        expect(uno('.zr-search-panel .zr-search-note')?.textContent).toBe(dellaLingua.searchHint);

        await scrivi('anna');
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(uno('.zr-search-panel [role="status"] span')?.textContent).toBe(dellaLingua.searchEmptyText);
    });

    // Sprint 100 (voce #2986, Decisione 20345): come la `Cornice` (#2801), una zona fuori dalla cornice, figlia di `body`, dice al
    // lettore di schermo quanti risultati ha trovato la ricerca. uat-cornice la cercava anche nello staff (Q.1) e non c'era.
    const zone = () => [...document.querySelectorAll<HTMLElement>('body > p[role="status"]')];

    it('T1.1 a ricerca finita una zona role=status figlia di body, nascosta alla vista, dice quante righe ha il pannello; si svuota a ogni ricerca che parte; smontata la cornice non c\'è più', async () => {
        const prima = inAttesa();
        const seconda = inAttesa();
        const cerca = vi.fn((parola: string, _segnale: AbortSignal) => (parola === 'an' ? prima.promessa : seconda.promessa));
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} onLogout={esci} />);

        expect(zone()).toHaveLength(1);
        expect(zone()[0]!.matches('.zr-visually-hidden')).toBe(true);
        expect(zone()[0]!.textContent).toBe('');

        await scrivi('an');
        await prima.arriva([anna, clienti]);
        expect(tutti('.zr-search-panel [role="option"]')).toHaveLength(2);
        expect(zone().map((zona) => zona.textContent)).toEqual([staffItaliano.searchCount.replace('{n}', '2')]);

        await scrivi('ann');
        expect(zone().map((zona) => zona.textContent)).toEqual(['']);
        await seconda.arriva([]);
        expect(zone().map((zona) => zona.textContent)).toEqual([staffItaliano.searchCount.replace('{n}', '0')]);

        await act(async () => radice.render(<p>Altro</p>));
        expect(zone()).toHaveLength(0);
    });

    it('T1.1 il numero è nella lingua dello staff, e una ricerca in errore non scrive un numero', async () => {
        const prima = inAttesa();
        const seconda = inAttesa();
        const cerca = vi.fn((parola: string, _segnale: AbortSignal) => (parola === 'an' ? prima.promessa : seconda.promessa));
        await mostra(<CorniceDelloStaff lingua="es" persona={staff} cerca={cerca} onLogout={esci} />);

        await scrivi('an');
        await prima.arriva([anna]);
        expect(zone().map((zona) => zona.textContent)).toEqual(['Resultados: 1']);

        await scrivi('cli');
        await seconda.fallisce(new Error('500'));
        expect(zone().map((zona) => zona.textContent)).toEqual(['']);
    });

    it('T1.2 il testo di quanti risultati sta nei tre file dello staff, col numero da mettere', () => {
        expect([staffItaliano.searchCount, staffSpagnolo.searchCount, staffInglese.searchCount]).toEqual(['Risultati: {n}', 'Resultados: {n}', 'Results: {n}']);
    });

    // Sprint 105 (voce #2965): ogni ricerca dello staff consuma il tetto orario del backoffice, e il modulo la vuole solo con Invio:
    // `cercaAllInvio` passa `searchOn="submit"` all'`AppShell` del design system (riga 164 delle richieste).
    /** Invio nel campo della ricerca. */
    async function invio(): Promise<void> {
        const campo = uno('.zr-search input') as HTMLInputElement;
        await act(async () => {
            campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await vi.advanceTimersByTimeAsync(0);
        });
    }

    it('con cercaAllInvio la cerca non parte mentre si scrive, nemmeno dopo i 300 ms; con Invio parte una volta, con la parola e un segnale (sprint 105, T2.1)', async () => {
        const risposta = inAttesa();
        const cerca = vi.fn((_parola: string, _segnale: AbortSignal) => risposta.promessa);
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} cercaAllInvio onLogout={esci} />);

        await scrivi('an');
        await scrivi('anna@example.com');
        await act(() => vi.advanceTimersByTimeAsync(2000));
        expect(cerca).not.toHaveBeenCalled();
        expect(inCaricamento()).toBe(false);

        await invio();
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(cerca.mock.calls[0]![0]).toBe('anna@example.com');
        expect(cerca.mock.calls[0]![1]).toBeInstanceOf(AbortSignal);
        expect(inCaricamento()).toBe(true);

        await risposta.arriva([anna]);
        expect(titoli()).toEqual(['Anna Ricci']);
        expect(cerca).toHaveBeenCalledTimes(1);
    });

    it('con cercaAllInvio, con meno di 2 caratteri, Invio non chiama la cerca (sprint 105, T2.1)', async () => {
        const cerca = vi.fn(async (_parola: string, _segnale: AbortSignal) => [anna]);
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} cercaAllInvio onLogout={esci} />);

        await scrivi('a');
        await invio();
        expect(cerca).not.toHaveBeenCalled();
    });

    it.each([
        ['it', staffItaliano],
        ['es', staffSpagnolo],
        ['en', staffInglese],
        ['de', staffInglese],
    ])('con cercaAllInvio, in %s, l\'invito dice di premere Invio, e prima di Invio il pannello dice «Premi Invio per cercare» con la parola (sprint 105, T2.2)', async (lingua, dellaLingua) => {
        await mostra(<CorniceDelloStaff lingua={lingua} persona={staff} cerca={async () => [anna]} cercaAllInvio onLogout={esci} />);

        await scrivi('a');
        expect(uno('.zr-search-panel .zr-search-note')?.textContent).toBe(dellaLingua.searchSubmitHint);

        await scrivi('anna');
        expect(uno('.zr-search-panel .zr-search-note')?.textContent).toBe(`${dellaLingua.searchPressEnter} «anna»`);
        expect(inCaricamento()).toBe(false);
    });

    it('con cercaAllInvio una parola cambiata dopo i risultati torna a «Premi Invio» senza chiamare la cerca né annullare la richiesta di prima; Invio su un risultato lo apre con naviga (sprint 105, T2.3)', async () => {
        const cerca = vi.fn(async (_parola: string, _segnale: AbortSignal) => [anna, clienti]);
        const naviga = vi.fn();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} cercaAllInvio naviga={naviga} onLogout={esci} />);
        await scrivi('an');
        await invio();
        expect(titoli()).toEqual(['Anna Ricci', 'Clienti']);

        await scrivi('cl');
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(cerca.mock.calls[0]![1].aborted).toBe(false);
        expect(inCaricamento()).toBe(false);
        expect(uno('.zr-search-panel .zr-search-note')?.textContent).toBe(`${staffItaliano.searchPressEnter} «cl»`);

        // Tornata la parola cercata, i suoi risultati sono ancora lì, e Invio apre il primo.
        await scrivi('an');
        expect(titoli()).toEqual(['Anna Ricci', 'Clienti']);
        await invio();
        expect(naviga).toHaveBeenCalledWith('/utenti/u1');
        expect(cerca).toHaveBeenCalledTimes(1);
    });

    it('con cercaAllInvio la zona di quanti risultati non dice il numero di una parola che non è più nel campo (revisione dello sprint 105, R1)', async () => {
        const risposta = inAttesa();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={() => risposta.promessa} cercaAllInvio onLogout={esci} />);
        await scrivi('an');
        await invio();

        // Mentre «an» carica si scrive «anc»: la risposta di «an», che non si annulla, non va al lettore di schermo.
        await scrivi('anc');
        await risposta.arriva([anna, clienti]);
        expect(zone().map((zona) => zona.textContent)).toEqual(['']);

        // Con la parola cercata nel campo e Invio di nuovo, il numero si dice.
        const seconda = inAttesa();
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={() => seconda.promessa} cercaAllInvio onLogout={esci} />);
        await invio();
        await seconda.arriva([anna]);
        expect(zone().map((zona) => zona.textContent)).toEqual(['Risultati: 1']);
    });

    it.each([[undefined], [false]])('con cercaAllInvio=%s la ricerca parte da sola dal secondo carattere, come prima (sprint 105, T2.4)', async (cercaAllInvio) => {
        const cerca = vi.fn(async (_parola: string, _segnale: AbortSignal) => [anna]);
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} cerca={cerca} {...(cercaAllInvio === undefined ? {} : { cercaAllInvio })} onLogout={esci} />);

        await scrivi('an');
        expect(cerca).toHaveBeenCalledTimes(1);
        expect(cerca.mock.calls[0]![0]).toBe('an');
    });

    it('i testi della ricerca all\'invio stanno nei tre file dello staff, non nelle lingue della cornice (sprint 105, T2.2; Decisione 20570)', () => {
        expect([staffItaliano.searchPressEnter, staffSpagnolo.searchPressEnter, staffInglese.searchPressEnter]).toEqual(['Premi Invio per cercare', 'Pulsa Intro para buscar', 'Press Enter to search']);
        for (const lingua of ['it', 'es', 'en']) {
            expect(Object.keys(testi(lingua))).not.toContain('searchSubmitHint');
            expect(Object.keys(testi(lingua))).not.toContain('searchPressEnter');
        }
    });
});

describe('tastiera e salto della cornice dello staff', () => {
    it('T3.1 «Salta al contenuto» sta prima della cornice e porta il fuoco al contenuto della pagina', async () => {
        await mostra(<CorniceDelloStaff lingua="es" persona={staff} nav={nav} onLogout={esci}><p>La pagina</p></CorniceDelloStaff>);

        const salto = contenitore.firstElementChild?.querySelector('button');
        expect(salto?.textContent).toBe(testi('es').skipToContent);
        expect(contenitore.firstElementChild?.nextElementSibling?.classList.contains('zr-shell')).toBe(true);

        await clic(salto!);
        expect(document.activeElement).toBe(uno('main.zr-main'));
    });

    it('T3.1 i rimedi di tastiera arrivano come per la Cornice: con la naviga dello staff e i nomi della sua lingua', async () => {
        const via = vi.spyOn(rimedi, 'via');
        const naviga = vi.fn();
        await mostra(<CorniceDelloStaff lingua="en" persona={staff} nav={nav} naviga={naviga} onLogout={esci} />);
        await act(() => vi.dynamicImportSettled());

        expect(via).toHaveBeenCalledWith(naviga, testi('en').mainContent, testi('en').searchResults);
    });
});

// Sprint 107 (voce #2989, Decisione 20721 di zr-pm-07): in fondo alla barra il riquadro dice il ruolo dello staff e fin quando
// dura al più la sessione, come la barra del prototipo superadmin; «al più tardi», perché 30 minuti d'inattività la chiudono prima.
describe('il ruolo e la fine della sessione nel riquadro della barra (sprint 107)', () => {
    const fuso = process.env.TZ;
    beforeEach(() => {
        process.env.TZ = 'Europe/Rome';
    });
    afterEach(() => {
        if (fuso === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = fuso;
        }
    });

    it('T1.1 con un ruolo il titolo è il ruolo con «· 2FA»; senza, o vuoto, è quello di prima', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} ruolo="Superadmin" onLogout={esci} />);
        expect(uno('.zr-plan strong')?.textContent).toBe('Superadmin · 2FA');

        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} onLogout={esci} />);
        expect(uno('.zr-plan strong')?.textContent).toBe(staffItaliano.planTitle);

        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} ruolo=" " onLogout={esci} />);
        expect(uno('.zr-plan strong')?.textContent).toBe(staffItaliano.planTitle);
    });

    it('T1.2 con la fine della sessione il testo dice l\'ora locale, non quella UTC della stringa', async () => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} sessioneFinoA="2026-11-04T17:30:00Z" onLogout={esci} />);

        expect(uno('.zr-plan span')?.textContent).toBe('Sessione al più tardi fino alle 18:30. Ogni azione va nel registro.');
    });

    it.each(['', 'domani', 'undefined'])('T1.3 senza una fine che si legge («%s») il testo è quello di prima, mai rotto', async (fine) => {
        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} sessioneFinoA={fine} onLogout={esci} />);
        expect(uno('.zr-plan span')?.textContent).toBe(staffItaliano.planText);

        await mostra(<CorniceDelloStaff lingua="it" persona={staff} nav={nav} sessioneFinoA={undefined} onLogout={esci} />);
        expect(uno('.zr-plan')?.textContent).not.toMatch(/undefined|Invalid Date|NaN/);
        expect(uno('.zr-plan span')?.textContent).toBe(staffItaliano.planText);
    });

    it.each([
        ['es', 'Supervisor · 2FA', 'Sesión activa como máximo hasta las 18:30. Cada acción queda en el registro.'],
        // L'ora nella forma della lingua, come le date della campanella: in inglese a 12 ore.
        ['en', 'Superadmin · 2FA', 'Session active until 06:30 PM at the latest. Every action goes into the log.'],
        // In una lingua che zr-core non ha anche l'ora è nella forma dell'inglese, la lingua dei testi, come le date della campanella.
        ['de', 'Superadmin · 2FA', 'Session active until 06:30 PM at the latest. Every action goes into the log.'],
    ])('T1.4 in %s le due frasi della lingua, e in una lingua che zr-core non ha l\'inglese', async (lingua, titolo, testo) => {
        await mostra(<CorniceDelloStaff lingua={lingua} persona={staff} nav={nav} ruolo={titolo.split(' · ')[0]} sessioneFinoA="2026-11-04T17:30:00Z" onLogout={esci} />);

        expect(uno('.zr-plan strong')?.textContent).toBe(titolo);
        expect(uno('.zr-plan span')?.textContent).toBe(testo);
    });

    it('una lingua che Intl rifiuta (it_IT) non rompe la pagina, e un ruolo con «$&» si mostra com\'è (revisione dello sprint 107, R1 e R8)', async () => {
        await mostra(<CorniceDelloStaff lingua="it_IT" persona={staff} nav={nav} ruolo="Ruolo $& $'" sessioneFinoA="2026-11-04T17:30:00Z" onLogout={esci} />);

        expect(uno('.zr-plan strong')?.textContent).toBe("Ruolo $& $' · 2FA");
        expect(uno('.zr-plan span')?.textContent).toBe('Sessione al più tardi fino alle 18:30. Ogni azione va nel registro.');
    });
});
