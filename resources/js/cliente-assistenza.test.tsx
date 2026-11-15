import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorniceDelCliente, type DatiDelCliente } from './cliente';
import { testi } from './lingue';

// Voce #3878 (R3 della revisione della v4.34.0, zr-pm-74 15/11): lo staff entrato con «Accedi come» in un membro che è anche
// cliente apre «Il mio spazio», e la cornice del cliente ha la fascia di assistenza della `Cornice`: la barra sopra l'`AppShell`,
// dal pezzo degli avvisi, che si chiede solo in assistenza. In un file suo, come avvisi-a-richiesta.test.tsx: il caso conta quante
// volte il pezzo è stato chiesto, e un modulo si carica una volta per file.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chiesto = vi.hoisted(() => ({ volte: 0 }));
vi.mock('./avvisi', async (originale) => {
    chiesto.volte += 1;

    return originale();
});

const persona = { nome: 'Marta Rossi', email: 'marta.rossi@example.com', impronta: 'a1b2c3' };
const dati: DatiDelCliente = { lingua: 'it', persona, aziende: [], aggiornati_il: '2026-11-15T09:00:00.000000Z', non_lette: 1 };
const anna = { persona: { nome: 'Anna', cognome: 'Bianchi', email: 'anna@example.com' }, sola_lettura: false };
const notifica = {
    id: 'n-1', creata_il: '2026-11-15T08:00:00.000000Z', letta: false, app: 'bookings', tipo: 'bookings.cliente.prenotazione.confermata',
    autore_nome: null, risorsa_nome: 'Personal training', per_me: null, quando: null, azienda: 'Palestra Fit Arezzo', ids: { id: 'pr-1' },
};

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    // La sola rotta che la cornice del cliente chiama qui: l'elenco delle notifiche, all'apertura della campanella.
    vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => (indirizzo === '/cornice/cliente/notifiche'
        ? new Response(JSON.stringify({ data: [notifica], aggiornati_il: '2026-11-15T09:00:00.000000Z', persona: persona.email }), { headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ errore: 'non_trovato' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const mostra = async (elemento: ReactElement) => act(async () => radice.render(elemento));
const barra = () => contenitore.querySelector('.zr-assist-bar');
/** Ciò che la barra dice: il nome in grassetto, la prima riga intera, la riga piccola e i pulsanti. */
const fascia = () => [barra()?.querySelector('strong')?.textContent, barra()?.querySelector(':scope > span > span:first-child')?.textContent, barra()?.querySelector(':scope > span > span:last-child')?.textContent, [...(barra()?.querySelectorAll('button') ?? [])].map((pulsante) => pulsante.textContent)];
/** Finché `fatto` non è vero, al più per due secondi, un giro alla volta dentro `act` (il pezzo passa dalla fabbrica di `vi.mock`). */
const finoA = async (fatto: () => boolean) => {
    for (let giri = 0; giri < 200 && !fatto(); giri++) {
        await act(async () => {
            await vi.dynamicImportSettled();
            await new Promise((passato) => setTimeout(passato, 10));
        });
    }
};

describe('la fascia di assistenza nella cornice del cliente (voce #3878)', () => {
    it('senza `assistenza` il pezzo degli avvisi non si chiede, e non c\'è né barra né contenitore: la cornice del cliente è quella di sempre (T1.4)', async () => {
        await mostra(<CorniceDelCliente dati={dati} onLogout={() => {}} />);
        await finoA(() => false);

        expect([chiesto.volte, barra(), contenitore.querySelector('.zr-assist'), contenitore.firstElementChild?.classList.contains('zr-shell')]).toStrictEqual([0, null, null, true]);
    });

    it('con `assistenza` la barra sta sopra l\'AppShell, nel contenitore `zr-assist`, con `role="status"`: la persona assistita, che cosa valgono le modifiche, e «Termina e torna al backoffice», che chiama `onLogout`; in sola lettura la riga della sola lettura (T1.4)', async () => {
        const esci = vi.fn();
        await mostra(<CorniceDelCliente dati={{ ...dati, assistenza: anna }} onLogout={esci}><p>La pagina</p></CorniceDelCliente>);
        await finoA(() => barra() !== null);

        const contenitoreDellaFascia = contenitore.firstElementChild;
        expect([contenitoreDellaFascia?.className, [...(contenitoreDellaFascia?.children ?? [])].map((figlio) => figlio.className)]).toStrictEqual(['zr-assist', ['zr-assist-bar', '']]);
        expect(contenitoreDellaFascia?.lastElementChild?.firstElementChild?.classList.contains('zr-shell')).toBe(true);
        expect(contenitore.querySelector('.zr-shell')?.contains(barra())).toBe(false);
        expect(barra()?.getAttribute('role')).toBe('status');
        expect(fascia()).toStrictEqual(['Anna Bianchi', 'Stai usando Zeiras come Anna Bianchi · anna@example.com', 'Le modifiche che fai valgono come fatte da Anna', ['Termina e torna al backoffice']]);
        expect(contenitore.querySelector('main')?.textContent).toBe('La pagina');

        await act(async () => (barra()?.querySelector('button') as HTMLElement).click());
        expect(esci).toHaveBeenCalledTimes(1);

        await mostra(<CorniceDelCliente dati={{ ...dati, lingua: 'es', assistenza: { ...anna, sola_lettura: true } }} onLogout={esci} />);
        await finoA(() => String(fascia()[1]).startsWith('Estás'));
        expect(fascia()).toStrictEqual(['Anna Bianchi', 'Estás usando Zeiras como Anna Bianchi · anna@example.com', 'Solo lectura: puedes mirar, no modificar', ['Terminar y volver al backoffice']]);
        expect(chiesto.volte).toBe(1);
    });

    it('in assistenza il pannello delle notifiche del cliente non ha «Segna tutte come lette»; senza, sì (T1.5)', async () => {
        const segnaTutte = () => [...contenitore.querySelectorAll('.zr-notif button')].some((pulsante) => pulsante.textContent === testi('it').markAllRead);
        const aperta = async (deiDati: DatiDelCliente) => {
            await mostra(<CorniceDelCliente dati={deiDati} onLogout={() => {}} />);
            await act(async () => (contenitore.querySelector('.zr-bell') as HTMLElement).click());
            await finoA(() => contenitore.querySelector('.zr-notif .zr-notif-item') !== null);
            expect(contenitore.querySelector('.zr-notif .zr-notif-item')).not.toBeNull();
        };

        await aperta(dati);
        expect(segnaTutte()).toBe(true);
        await act(async () => radice.unmount());
        radice = createRoot(contenitore);

        await aperta({ ...dati, assistenza: anna });
        expect(segnaTutte()).toBe(false);
    });
});
