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

const mostra = async (deiDati: DatiDellaCornice) => act(async () => radice.render(<Cornice dati={deiDati} product="pm" onLogout={() => {}}><p>La pagina</p></Cornice>));
const arrivati = async () => act(() => vi.dynamicImportSettled());
const sopraLaPagina = () => contenitore.querySelector('main .zr-alert')?.textContent ?? null;

describe('i testi degli avvisi arrivano con un pezzo a richiesta, chiesto solo nella cornice ridotta (v3.7.0)', () => {
    it('la cornice di sempre non chiede il pezzo e non ha l\'avviso; con l\'accettazione richiesta lo chiede, e l\'avviso c\'è quando il pezzo è arrivato; con `non_letti` in un\'altra lingua non lo richiede e dice il suo avviso in quella lingua', async () => {
        await mostra(dati);
        await arrivati();
        expect([chiesto.volte, sopraLaPagina()]).toStrictEqual([0, null]);

        await mostra({ ...dati, prodotti: {}, aziende: [], non_lette: 0, accettazione_richiesta: true });
        await arrivati();
        expect(chiesto.volte).toBe(1);
        expect(sopraLaPagina()).toBe(italiani.acceptanceTitle + italiani.acceptanceText + italiani.acceptanceAction);

        await mostra({ ...dati, lingua: 'es', non_letti: true });
        await arrivati();
        expect(chiesto.volte).toBe(1);
        expect(sopraLaPagina()).toBe(spagnoli.downTitle + spagnoli.downText);
    });

    it('in una lingua che non ha il suo file l\'avviso è in inglese', async () => {
        await mostra({ ...dati, lingua: 'pt-BR', non_letti: true });
        await arrivati();
        expect(sopraLaPagina()).toBe(inglesi.downTitle + inglesi.downText);
    });
});
