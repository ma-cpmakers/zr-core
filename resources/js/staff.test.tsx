import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { CorniceDelloStaff, type CorniceDelloStaffProps } from './staff';
import { testi } from './lingue';
import { registro } from './registro';
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

const staff = { nome: 'Martina Bianchi', email: 'martina@zeiras.com' };
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
