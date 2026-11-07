import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cornice, type CorniceProps } from './cornice';
import type { DatiDellaCornice } from './index';
import { LayoutDellaCornice } from './layout';

// Sprint 118 (voce #3417, Decisione 22468, per zr-home #3416): con la prop `spazio` la cornice dei membri mette in cima al
// selettore «Azienda › workspace» il gruppo «Come cliente» con «Il mio spazio» (design dcc4, schermata 13). I due testi stanno
// nel pezzo degli avvisi, che la cornice chiede solo con la prop: finché non è arrivato la voce non c'è. Qui il pezzo è quello
// vero, trattenuto da un cancello finché il primo caso con la prop non ha guardato la cornice senza: in un file suo, perché un
// modulo si carica una volta per file. Che i testi non stiano nel JS d'ingresso lo prova `peso.test.ts`.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chiesto = vi.hoisted(() => {
    let apri = () => {};
    const cancello = new Promise<void>((fatto) => (apri = fatto));

    return { volte: 0, cancello, apri: () => apri() };
});
vi.mock('./avvisi', async (originale) => {
    chiesto.volte += 1;
    await chiesto.cancello;

    return originale();
});

const acme = { id: 'az-1', nome: 'Acme', workspace: [{ id: 'ws-1', nome: 'Marketing', slug: 'acme-marketing' }] };
const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo' },
    aziende: [acme],
};

let contenitore: HTMLDivElement;
let radice: Root;
/** Ogni clic arrivato in fondo: se la cornice lo aveva fermato. Poi lo ferma il caso, perché jsdom non sa aprire un indirizzo. */
let clic: boolean[];
const inFondo = (evento: Event) => {
    if (evento.type === 'click' && (evento.target as Element).closest('.zr-ws-menu')) {
        clic.push(evento.defaultPrevented);
        evento.preventDefault();
    }
};

beforeEach(() => {
    contenitore = document.createElement('div');
    document.body.append(contenitore);
    radice = createRoot(contenitore);
    clic = [];
    document.addEventListener('click', inFondo);
    vi.spyOn(console, 'error');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }) as Response));
});

afterEach(async () => {
    await act(async () => radice.unmount());
    document.removeEventListener('click', inFondo);
    contenitore.remove();
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const mostra = async (deiDati: DatiDellaCornice, props: Partial<CorniceProps> = {}) =>
    act(async () => radice.render(<Cornice dati={deiDati} product="pm" onLogout={() => {}} {...props}><p>La pagina</p></Cornice>));
/** Apre il selettore e dice i suoi gruppi: il titolo, e di ogni voce il testo, l'indirizzo, se è attiva. */
const gruppi = async () => {
    await act(async () => contenitore.querySelector<HTMLButtonElement>('.zr-ws-switch')!.click());

    return [...contenitore.querySelectorAll('.zr-ws-menu .zr-ws-group')].map((gruppo) => [
        gruppo.querySelector('.zr-ws-group-title')!.textContent,
        ...[...gruppo.querySelectorAll('.zr-ws-item')].map((voce) => [voce.textContent, voce.getAttribute('href'), voce.matches('.is-active') || voce.hasAttribute('aria-current')]),
    ]);
};
const ilSelettore = () => contenitore.querySelector('.zr-ws-switch')!.getAttribute('aria-label');
/** Finché nel selettore non c'è «Come cliente» (o un altro primo gruppo), al più per due secondi, un giro alla volta dentro `act`. */
const finoAlGruppo = async (titolo: string) => {
    for (let giri = 0; giri < 200; giri++) {
        const visto = (await gruppi())[0]?.[0];
        await act(async () => contenitore.querySelector<HTMLButtonElement>('.zr-ws-switch')!.click());
        if (visto === titolo) {
            return;
        }
        await act(async () => {
            await vi.dynamicImportSettled();
            await new Promise((fatto) => setTimeout(fatto, 10));
        });
    }
    throw new Error(`in cima al selettore non è arrivato «${titolo}»: il pezzo si apre nel primo caso, che va lanciato prima`);
};

describe('«Il mio spazio» nel selettore della cornice dei membri (sprint 118)', () => {
    it('senza `spazio` né gruppo «Come cliente» né pezzo chiesto, e nemmeno con `spazio` quando il selettore non c\'è (il workspace dei dati non sta in un\'azienda); con `spazio` la voce arriva col pezzo, che si chiede una volta (T1.2, T1.3)', async () => {
        await mostra(dati);
        await mostra(dati, { spazio: undefined });
        await act(() => vi.dynamicImportSettled());
        expect([chiesto.volte, await gruppi()]).toStrictEqual([0, [['Acme', ['Marketing', null, true]]]]);
        await act(async () => contenitore.querySelector<HTMLButtonElement>('.zr-ws-switch')!.click());

        for (const aziende of [[], [{ ...acme, workspace: [{ id: 'ws-2', nome: 'Altro', slug: 'acme-altro' }] }]]) {
            await mostra({ ...dati, aziende }, { spazio: { href: '/spazio' } });
            await act(() => vi.dynamicImportSettled());
            expect([chiesto.volte, contenitore.querySelector('.zr-ws-switch')]).toStrictEqual([0, null]);
        }

        await mostra(dati, { spazio: { href: '/spazio' } });
        expect([chiesto.volte, await gruppi()]).toStrictEqual([1, [['Acme', ['Marketing', null, true]]]]);
        await act(async () => contenitore.querySelector<HTMLButtonElement>('.zr-ws-switch')!.click());

        chiesto.apri();
        await finoAlGruppo('Come cliente');
        expect(chiesto.volte).toBe(1);
    });

    it('con `spazio` il gruppo «Come cliente» sta in cima con «Il mio spazio», che punta all\'indirizzo e non è attiva: il selettore dice ancora azienda › workspace (T1.1)', async () => {
        await mostra(dati, { spazio: { href: '/spazio' } });
        await finoAlGruppo('Come cliente');
        expect(await gruppi()).toStrictEqual([
            ['Come cliente', ['Il mio spazio', '/spazio', false]],
            ['Acme', ['Marketing', null, true]],
        ]);
        expect(ilSelettore()).toBe('Cambia workspace: Acme › Marketing');
    });

    it('i testi nella lingua della persona, e in inglese in una lingua senza file (T1.3)', async () => {
        const visti = [];
        for (const [lingua, gruppo] of [['es', 'Como cliente'], ['en', 'As a customer'], ['pt-BR', 'As a customer']] as const) {
            await mostra({ ...dati, lingua }, { spazio: { href: '/spazio' } });
            await finoAlGruppo(gruppo);
            visti.push((await gruppi())[0]);
            await act(async () => contenitore.querySelector<HTMLButtonElement>('.zr-ws-switch')!.click());
        }
        expect(visti).toStrictEqual([
            ['Como cliente', ['Mi espacio', '/spazio', false]],
            ['As a customer', ['My space', '/spazio', false]],
            ['As a customer', ['My space', '/spazio', false]],
        ]);
    });

    it('un clic semplice apre l\'indirizzo con `naviga`; con un modificatore, il tasto centrale o un\'altra origine decide il browser (T1.4)', async () => {
        const naviga = vi.fn();
        const voce = async (href: string, come: MouseEventInit = {}) => {
            await mostra(dati, { spazio: { href }, naviga });
            await finoAlGruppo('Come cliente');
            await gruppi();
            await act(async () => contenitore.querySelector('.zr-ws-menu .zr-ws-item')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...come })));
        };
        await voce('/spazio');
        for (const come of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
            await voce('/spazio', come);
        }
        await voce('https://altro.example.com/spazio');
        expect([naviga.mock.calls, clic]).toStrictEqual([[[`${location.origin}/spazio`]], [true, false, false, false, false, false, false]]);
    });

    it('`LayoutDellaCornice` passa `spazio` alla cornice (T1.1)', async () => {
        await act(async () => radice.render(<LayoutDellaCornice cornice={dati} product="pm" onLogout={() => {}} spazio={{ href: '/spazio' }}><p>La pagina</p></LayoutDellaCornice>));
        await finoAlGruppo('Come cliente');
        expect((await gruppi())[0]).toStrictEqual(['Come cliente', ['Il mio spazio', '/spazio', false]]);
    });
});
