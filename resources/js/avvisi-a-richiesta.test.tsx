import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import inglesi from '../lingue/avvisi/en.json';
import spagnoli from '../lingue/avvisi/es.json';
import italiani from '../lingue/avvisi/it.json';
import { Cornice } from './cornice';
import type { DatiDellaCornice } from './index';

// v3.7.0 (zr-pm, 26/10/2026). I testi dei due avvisi della cornice ridotta — chi non ha accettato i documenti legali, e Zeiras
// che non risponde — stanno in un pezzo a richiesta (`./avvisi`): la cornice lo chiede solo quando passa a uno di quei due
// stati, e l'avviso c'è quando il pezzo è arrivato. Qui il pezzo è quello vero, e il caso conta quante volte è stato chiesto:
// in un file suo, perché un modulo si carica una volta per file, e qui nessuno lo importa prima della cornice. Che i testi
// non stiano nel JS d'ingresso lo prova `peso.test.ts`.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chiesto = vi.hoisted(() => ({ volte: 0 }));
vi.mock('./avvisi', async (originale) => {
    chiesto.volte += 1;

    return originale();
});

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo' },
};

let contenitore: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    vi.spyOn(console, 'error');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }) as Response));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const mostra = async (deiDati: DatiDellaCornice, onLogout = () => {}) => act(async () => radice.render(<Cornice dati={deiDati} product="pm" onLogout={onLogout}><p>La pagina</p></Cornice>));
const arrivati = async () => act(() => vi.dynamicImportSettled());
/**
 * Finché sopra la pagina non c'è quel testo, al più per due secondi, un giro alla volta dentro `act`. Il pezzo passa dalla
 * fabbrica di `vi.mock`, che carica il modulo vero per conto suo: `dynamicImportSettled` non sempre lo aspetta, e da solo
 * lasciava il caso rosso una volta su tre (26/10/2026).
 */
const finoAlTesto = async (testo: string) => {
    for (let giri = 0; giri < 200 && sopraLaPagina() !== testo; giri++) {
        await act(async () => {
            await vi.dynamicImportSettled();
            await new Promise((fatto) => setTimeout(fatto, 10));
        });
    }
};
const sopraLaPagina = () => contenitore.querySelector('main .zr-alert')?.textContent ?? null;

describe('i testi degli avvisi arrivano con un pezzo a richiesta, chiesto solo nella cornice ridotta (v3.7.0)', () => {
    it('la cornice di sempre non chiede il pezzo e non ha l\'avviso; con l\'accettazione richiesta lo chiede, e l\'avviso c\'è quando il pezzo è arrivato; con `non_letti` in un\'altra lingua non lo richiede e dice il suo avviso in quella lingua', async () => {
        await mostra(dati);
        await arrivati();
        expect([chiesto.volte, sopraLaPagina()]).toStrictEqual([0, null]);

        await mostra({ ...dati, prodotti: {}, aziende: [], non_lette: 0, accettazione_richiesta: true });
        await finoAlTesto(italiani.acceptanceTitle + italiani.acceptanceText + italiani.acceptanceAction);
        expect(chiesto.volte).toBe(1);
        expect(sopraLaPagina()).toBe(italiani.acceptanceTitle + italiani.acceptanceText + italiani.acceptanceAction);

        await mostra({ ...dati, lingua: 'es', non_letti: true });
        await finoAlTesto(spagnoli.downTitle + spagnoli.downText);
        expect(chiesto.volte).toBe(1);
        expect(sopraLaPagina()).toBe(spagnoli.downTitle + spagnoli.downText);
    });

    it('in una lingua che non ha il suo file l\'avviso è in inglese', async () => {
        await mostra({ ...dati, lingua: 'pt-BR', non_letti: true });
        await finoAlTesto(inglesi.downTitle + inglesi.downText);
        expect(sopraLaPagina()).toBe(inglesi.downTitle + inglesi.downText);
    });
});

// Sprint 115 · T3 (voce #2909, Decisione 22312): quando lo staff è entrato con «Accedi come», sopra la pagina la fascia di
// assistenza — l'Alert del design system, tono `warning` — dice chi è la persona assistita, la sua email, che cosa valgono le
// modifiche, e ha il pulsante che termina l'assistenza. I testi stanno nel pezzo degli avvisi, che allora si chiede.
describe('la fascia di assistenza (sprint 115 · T3)', () => {
    const anna = { persona: { nome: 'Anna', cognome: 'Bianchi', email: 'anna@example.com' }, sola_lettura: false };
    const avvisiSopra = () => [...contenitore.querySelectorAll('main .zr-alert')].map((avviso) => [avviso.className, avviso.querySelector('strong')?.textContent, avviso.querySelector('.zr-alert-body > div')?.textContent, [...avviso.querySelectorAll('button')].map((pulsante) => pulsante.textContent)]);
    const fascia = (titolo: string, testo: string, pulsante: string) => ['zr-alert zr-alert-warning', titolo, testo, [pulsante]];
    const finoAllaFascia = async () => {
        for (let giri = 0; giri < 200 && contenitore.querySelector('main .zr-alert') === null; giri++) {
            await act(async () => {
                await vi.dynamicImportSettled();
                await new Promise((fatto) => setTimeout(fatto, 10));
            });
        }
    };

    it('in italiano, spagnolo e inglese: il nome e il cognome nel titolo, l\'email e che cosa valgono le modifiche nel testo, il pulsante che termina; con la sola lettura il testo della sola lettura (T3.1)', async () => {
        await mostra({ ...dati, assistenza: anna });
        await finoAllaFascia();
        expect(avvisiSopra()).toStrictEqual([fascia('Stai usando Zeiras come Anna Bianchi', 'anna@example.com · Le modifiche che fai valgono come fatte da Anna', "Termina l'assistenza")]);

        await mostra({ ...dati, lingua: 'es', assistenza: { ...anna, sola_lettura: true } });
        expect(avvisiSopra()).toStrictEqual([fascia('Estás usando Zeiras como Anna Bianchi', 'anna@example.com · Solo lectura: puedes mirar, no modificar', 'Terminar la asistencia')]);

        await mostra({ ...dati, lingua: 'en', assistenza: { persona: { nome: 'Bob', cognome: null, email: 'bob@example.com' }, sola_lettura: false } });
        expect(avvisiSopra()).toStrictEqual([fascia("You're using Zeiras as Bob", 'bob@example.com · Changes you make count as made by Bob', 'End assistance')]);

        await mostra({ ...dati, assistenza: { ...anna, sola_lettura: true } });
        expect(avvisiSopra()).toStrictEqual([fascia('Stai usando Zeiras come Anna Bianchi', 'anna@example.com · Sola lettura: puoi guardare, non modificare', "Termina l'assistenza")]);
    });

    it('«Termina l\'assistenza» chiama `onLogout`, come «Esci» (T3.2)', async () => {
        const esci = vi.fn();
        await mostra({ ...dati, assistenza: anna }, esci);
        await finoAllaFascia();

        await act(async () => contenitore.querySelector<HTMLButtonElement>('main .zr-alert button')?.click());
        expect(esci).toHaveBeenCalledTimes(1);
    });

    it('la fascia non si chiude e resta nella cornice ridotta, sopra l\'avviso; senza `assistenza` nessuna fascia (T3.3; che la cornice di sempre non chieda il pezzo lo prova il primo caso del file)', async () => {
        await mostra({ ...dati, non_letti: true, assistenza: anna });
        await finoAllaFascia();
        expect(avvisiSopra()).toStrictEqual([
            fascia('Stai usando Zeiras come Anna Bianchi', 'anna@example.com · Le modifiche che fai valgono come fatte da Anna', "Termina l'assistenza"),
            ['zr-alert zr-alert-warning', italiani.downTitle, italiani.downText, []],
        ]);

        await mostra(dati);
        expect(avvisiSopra()).toStrictEqual([]);
    });

    it('in una lingua che non ha il suo file la fascia è in inglese (T3.4)', async () => {
        await mostra({ ...dati, lingua: 'pt-BR', assistenza: anna });
        await finoAllaFascia();
        expect(avvisiSopra()).toStrictEqual([fascia("You're using Zeiras as Anna Bianchi", 'anna@example.com · Changes you make count as made by Anna', 'End assistance')]);
        expect([inglesi, spagnoli, italiani].map((file) => Object.keys(file).filter((chiave) => chiave.startsWith('assist')))).toStrictEqual(Array(3).fill(['assistTitle', 'assistText', 'assistReadOnly', 'assistEnd']));
    });
});
