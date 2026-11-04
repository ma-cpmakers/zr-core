import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import inglese from '../lingue/en.json';
import spagnolo from '../lingue/es.json';
import italiano from '../lingue/it.json';
import type { DatiDellaCornice } from './index';

// Sprint 106 · T2 (voce 3015, Decisione 20618 di zr-pm). Nel JS d'ingresso c'è solo l'italiano: inglese e spagnolo arrivano a
// richiesta, e la cornice di chi parla un'altra lingua aspetta la sua invece di disegnarsi in italiano o in inglese. Qui i
// moduli sono nuovi a ogni caso (`vi.resetModules()`), senza le lingue che il file di preparazione dei test mette in memoria,
// e `fetch` tiene i file delle lingue finché il caso non li fa arrivare, o non arrivare.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// I rimedi di tastiera ascoltano il documento finché la pagina vive, e coi moduli nuovi a ogni caso quelli di un caso di prima
// darebbero al contenuto il nome nella sua lingua: qui non servono.
vi.mock('./rimedi', () => ({ via: () => {} }));

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo' },
};
const deiFile: Record<string, object> = { en: inglese, es: spagnolo };

/** I testi della cornice che solo quella lingua ha. */
const soloDi = (dellaLingua: Record<string, string>, ...altre: Record<string, string>[]) =>
    Object.values(dellaLingua).filter((testo) => testo.length > 3 && altre.every((altra) => !Object.values(altra).includes(testo)));
const soloItaliani = soloDi(italiano, inglese, spagnolo);
const soloInglesi = soloDi(inglese, italiano, spagnolo);

let contenitore: HTMLDivElement;
let radice: Root;
let act: typeof import('react').act;
let createElement: typeof import('react').createElement;
/** I file delle lingue chiesti, nell'ordine; e per ognuno come farlo arrivare o no. */
let chiesti: string[];
let inAttesa: Map<string, { arriva: () => void; nonArriva: () => void }>;
/** Ciò che la pagina ha mostrato, a ogni cambiamento: i testi e gli attributi. */
let mostrati: string[];
let osservatore: MutationObserver;

const visibile = () => [contenitore.textContent ?? '', ...[...contenitore.querySelectorAll('*')].flatMap((elemento) => [...elemento.attributes].map((attributo) => attributo.value))].join('\n');
/** I testi di un'altra lingua che la pagina ha mostrato. */
const inUnAltraLingua = (...diQuali: string[][]) => mostrati.flatMap((una) => diQuali.flat().filter((testo) => una.includes(testo)));

beforeEach(async () => {
    vi.resetModules();
    ({ act, createElement } = await import('react'));
    chiesti = [];
    inAttesa = new Map();
    mostrati = [];
    vi.stubGlobal(
        'fetch',
        vi.fn((indirizzo: RequestInfo | URL) => {
            const lingua = /\/lingue\/([\w-]+)\.json/.exec(String(indirizzo))?.[1];
            if (lingua === undefined || String(indirizzo).includes('/notifiche/')) {
                return Promise.resolve(Response.json({ data: [] }));
            }
            chiesti.push(lingua);

            return new Promise<Response>((arriva, nonArriva) =>
                inAttesa.set(lingua, { arriva: () => arriva(Response.json(deiFile[lingua])), nonArriva: () => nonArriva(new TypeError('Failed to fetch')) }),
            );
        }),
    );
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    osservatore = new MutationObserver(() => mostrati.push(visibile()));
    osservatore.observe(contenitore, { subtree: true, childList: true, characterData: true, attributes: true });
    const { createRoot } = await import('react-dom/client');
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
});

afterEach(async () => {
    await act(async () => radice.unmount());
    osservatore.disconnect();
    contenitore.remove();
    document.documentElement.lang = '';
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const mostra = async (elemento: ReactNode) => act(async () => radice.render(elemento));
const arrivano = async (...lingue: string[]) =>
    act(async () => {
        lingue.forEach((lingua) => inAttesa.get(lingua)?.arriva());
        await new Promise((fatto) => setTimeout(fatto, 0));
    });
const nonArriva = async (lingua: string) =>
    act(async () => {
        inAttesa.get(lingua)?.nonArriva();
        await new Promise((fatto) => setTimeout(fatto, 0));
    });
const laPagina = () => createElement('p', { id: 'pagina' }, 'La pagina');

describe('la cornice non si disegna in un\'altra lingua (sprint 106 · T2)', () => {
    it('in italiano la cornice e la pagina sono nel primo disegno, senza richieste di lingue (T2.1)', async () => {
        const { Cornice } = await import('./index');

        await mostra(createElement(Cornice, { dati, product: 'pm', onLogout: () => {} }, laPagina()));

        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).toContain(italiano.skipToContent);
        expect(chiesti).toStrictEqual([]);
    });

    it('in spagnolo cornice e pagina aspettano spagnolo e inglese, poi la cornice è in spagnolo: mai un testo italiano o inglese (T2.1)', async () => {
        const { Cornice } = await import('./index');

        await mostra(createElement(Cornice, { dati: { ...dati, lingua: 'es' }, product: 'pm', onLogout: () => {} }, laPagina()));
        expect([contenitore.innerHTML, [...chiesti].sort()]).toStrictEqual(['', ['en', 'es']]);

        await arrivano('es');
        expect(contenitore.innerHTML).toBe('');
        await arrivano('en');

        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).toContain(spagnolo.skipToContent);
        expect(inUnAltraLingua(soloItaliani, soloInglesi)).toStrictEqual([]);
    });

    it('da italiano a spagnolo la cornice resta in italiano finché lo spagnolo non arriva, e la pagina non si smonta (T2.2)', async () => {
        const { Cornice } = await import('./index');
        await mostra(createElement(Cornice, { dati, product: 'pm', onLogout: () => {} }, laPagina()));
        const pagina = contenitore.querySelector('#pagina');
        mostrati = [];

        await mostra(createElement(Cornice, { dati: { ...dati, lingua: 'es' }, product: 'pm', onLogout: () => {} }, laPagina()));
        expect(visibile()).toContain(italiano.skipToContent);
        await arrivano('es', 'en');

        expect(visibile()).toContain(spagnolo.skipToContent);
        expect(contenitore.querySelector('#pagina')).toBe(pagina);
        expect(inUnAltraLingua(soloInglesi)).toStrictEqual([]);
    });

    it('se la lingua non arriva la cornice si disegna in italiano, con la pagina; montata di nuovo la richiede (T2.3)', async () => {
        const { Cornice } = await import('./index');
        const inSpagnolo = () => createElement(Cornice, { dati: { ...dati, lingua: 'es' }, product: 'pm', onLogout: () => {} }, laPagina());

        await mostra(inSpagnolo());
        await nonArriva('es');

        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).toContain(italiano.skipToContent);

        await mostra(null);
        await mostra(inSpagnolo());
        expect(chiesti.filter((lingua) => lingua === 'es')).toHaveLength(2);
        await arrivano('es', 'en');
        expect(visibile()).toContain(spagnolo.skipToContent);
    });

    it('se la lingua non arriva, e la persona passa all\'italiano e torna allo spagnolo sulla stessa cornice, lo spagnolo si richiede (T2.3; revisione, D1)', async () => {
        const { Cornice } = await import('./index');
        const inLingua = (lingua: string) => createElement(Cornice, { dati: { ...dati, lingua }, product: 'pm', onLogout: () => {} }, laPagina());

        await mostra(inLingua('es'));
        await nonArriva('es');
        await mostra(inLingua('it'));
        await mostra(inLingua('es'));
        expect(chiesti.filter((lingua) => lingua === 'es')).toHaveLength(2);
        await arrivano('es', 'en');

        expect(visibile()).toContain(spagnolo.skipToContent);
    });

    it('la cornice dello staff in spagnolo aspetta la sua lingua come quella dei moduli (T2.4)', async () => {
        const { CorniceDelloStaff } = await import('./app');

        await mostra(createElement(CorniceDelloStaff, { lingua: 'es', persona: { nome: 'Ada Lovelace', email: 'ada@example.com' }, onLogout: () => {} }, laPagina()));
        expect(contenitore.innerHTML).toBe('');
        await arrivano('es', 'en');

        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).toContain(spagnolo.skipToContent);
        expect(inUnAltraLingua(soloItaliani, soloInglesi)).toStrictEqual([]);
    });

    it('senza dati la pagina si vede da sola, e la barra minima arriva nella lingua del documento, mai in un\'altra (T2.4)', async () => {
        const { LayoutDellaCornice } = await import('./index');
        document.documentElement.lang = 'es';

        await mostra(createElement(LayoutDellaCornice, { onLogout: () => {} }, laPagina()));
        await act(() => vi.dynamicImportSettled());
        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).not.toContain(spagnolo.skipToContent);
        await arrivano('es', 'en');
        await act(() => vi.dynamicImportSettled());

        expect(inUnAltraLingua(soloItaliani, soloInglesi)).toStrictEqual([]);
        expect(mostrati.some((una) => una.includes(spagnolo.skipToContent) || una.includes(spagnolo.logout))).toBe(true);
    });

    it('con `<html lang="es">` spagnolo e inglese si chiedono quando il JS d\'ingresso è eseguito, prima di ogni render (T2.5)', async () => {
        document.documentElement.lang = 'es-ES';

        await import('./app');

        expect([...chiesti].sort()).toStrictEqual(['en', 'es']);
        expect(contenitore.innerHTML).toBe('');
    });
});

// Sprint 106 · T4.2 (voce 3015). Col precarico del server (`Cornice::precaricoDellaLingua()`) la lingua chiesta da `<html lang>`
// arriva prima che la cornice si monti: in Chromium fra il primo disegno, vuoto, e l'effetto che l'avrebbe chiesta. L'effetto la
// trova pronta, e la cornice deve ridisegnarsi: senza, restava vuota per sempre (la UAT, R.L.1 su layout.html in spagnolo).
describe('la lingua che arriva fra il disegno e l\'effetto (sprint 106 · T4.2)', () => {
    it('in spagnolo, con la lingua arrivata dopo il primo disegno e prima del suo effetto, la cornice si disegna in spagnolo e non resta vuota', async () => {
        const attese = new Map<string, () => void>();
        // Risposte senza flussi: arrivano in qualche microtask, prima del giro in cui React fa gli effetti.
        vi.stubGlobal(
            'fetch',
            vi.fn((indirizzo: RequestInfo | URL) => {
                const lingua = /\/lingue\/([\w-]+)\.json/.exec(String(indirizzo))?.[1] ?? '';

                return new Promise((arriva) => attese.set(lingua, () => arriva({ ok: true, json: () => Promise.resolve(deiFile[lingua] ?? { data: [] }) })));
            }),
        );
        document.documentElement.lang = 'es';
        const { Fragment } = await import('react');
        const { Cornice } = await import('./index');
        expect([...attese.keys()].sort()).toStrictEqual(['en', 'es']);
        // Le lingue arrivano mentre React disegna: il primo disegno della cornice è vuoto, l'effetto viene dopo che sono arrivate.
        const Arrivano = () => {
            attese.forEach((arriva) => arriva());
            return null;
        };
        const ambiente = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
        ambiente.IS_REACT_ACT_ENVIRONMENT = false;
        try {
            radice.render(createElement(Fragment, null, createElement(Arrivano), createElement(Cornice, { dati: { ...dati, lingua: 'es' }, product: 'pm', onLogout: () => {} }, laPagina())));
            for (let volta = 0; volta < 30 && contenitore.querySelector('#pagina') === null; volta++) {
                await new Promise((fatto) => setTimeout(fatto, 10));
            }
        } finally {
            ambiente.IS_REACT_ACT_ENVIRONMENT = true;
        }

        expect(contenitore.querySelector('#pagina')).not.toBeNull();
        expect(visibile()).toContain(spagnolo.skipToContent);
        expect(inUnAltraLingua(soloItaliani, soloInglesi)).toStrictEqual([]);
    });
});
