import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { premi, trattieni } from './tocco';
import { DealPipeline } from './zeiras/componenti';

// v4.35.2 (richiesta 293, zr-pm-74 16/11): le carte della DealPipeline col dito. Il DOM finto non ha la geometria: dove sta il
// dito lo dice `elementFromPoint`, che qui risponde con l'elemento scelto dal caso. Nel Chromium vero, col tocco emulato, la
// stessa cosa la provano le righe TC di uat-cornice (`--tocco`).

const FASI = [
    { id: 'new', title: 'Nuovo lead', deals: [{ id: 'd1', title: 'Corso Leadership', company: 'Rossi', amount: 7200, probability: 10 }] },
    { id: 'prop', title: 'Proposta', deals: [{ id: 'd4', title: 'Percorso manager', company: 'Alfa', amount: 18500, probability: 55 }] },
];
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aspetta = (ms: number) => new Promise((fatto) => setTimeout(fatto, ms));

let radice: Root;
let contenitore: HTMLElement;
let sottoIlDito: Element | null;
const onMove = vi.fn();
const onOpen = vi.fn();

beforeEach(async () => {
    contenitore = document.body.appendChild(document.createElement('div'));
    radice = createRoot(contenitore);
    await act(async () => radice.render(<DealPipeline stages={FASI} onMove={onMove} onOpen={onOpen} />));
    sottoIlDito = null;
    document.elementFromPoint = () => sottoIlDito;
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    onMove.mockReset();
    onOpen.mockReset();
});

const carta = (id: string) => document.querySelector<HTMLElement>(`[data-deal-id="${id}"]`)!;
const colonna = (id: string) => document.querySelector<HTMLElement>(`[data-stage="${id}"]`)!;
const dito = (tipo: string, dove: Element, x: number, y: number, pointerType = 'touch') => {
    const evento = new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 7, pointerType, clientX: x, clientY: y });
    dove.dispatchEvent(evento);

    return evento;
};
/** Il dito si posa sulla carta: come il pezzo dei rimedi, `premi` riceve il `pointerdown`. */
const posa = (id: string, x = 20, y = 20) => premi(dito('pointerdown', carta(id), x, y));

it('una pressione di 250 ms prende la carta: segue il dito in una copia, e al rilascio su un\'altra colonna la DealPipeline la sposta con onMove (TC.1)', async () => {
    posa('d1');
    await act(() => aspetta(300));

    const ombra = document.querySelector('.zr-tocco-ombra');
    expect(ombra).not.toBeNull();
    expect(ombra?.getAttribute('aria-hidden')).toBe('true');
    expect(carta('d1').classList.contains('is-dragging')).toBe(true);

    sottoIlDito = colonna('prop');
    await act(async () => void dito('pointermove', document.body, 200, 40));
    await act(async () => void dito('pointerup', document.body, 200, 40));

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.slice(1)).toStrictEqual(['prop', 'new']);
    expect(colonna('prop').contains(carta('d1'))).toBe(true);
    expect(document.querySelector('.zr-tocco-ombra')).toBeNull();
    expect(document.querySelector('.is-dragging')).toBeNull();
    // Deve fallire se: il clic che il browser manda dopo il dito alzato apre la carta appena lasciata.
    await act(async () => void carta('d1').click());
    expect(onOpen).not.toHaveBeenCalled();
});

it('rilasciata fuori da ogni colonna, la carta resta dov\'era e non si chiama onMove (TC.2)', async () => {
    posa('d1');
    await act(() => aspetta(300));
    sottoIlDito = document.body;
    await act(async () => void dito('pointerup', document.body, 5, 5));

    expect(onMove).not.toHaveBeenCalled();
    expect(colonna('new').contains(carta('d1'))).toBe(true);
    expect(document.querySelector('.zr-tocco-ombra, .is-dragging')).toBeNull();
});

it('un dito che si muove prima dei 250 ms è uno scorrimento: niente presa, e lo scorrimento della pagina non si ferma (TC.3)', async () => {
    posa('d1');
    await act(async () => void dito('pointermove', document.body, 20, 60));
    const scorrimento = new Event('touchmove', { bubbles: true, cancelable: true });
    trattieni(scorrimento);
    await act(() => aspetta(300));

    expect(scorrimento.defaultPrevented).toBe(false);
    expect(document.querySelector('.zr-tocco-ombra, .is-dragging')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
});

it('presa la carta, il dito non fa più scorrere la pagina (TC.3)', async () => {
    posa('d1');
    await act(() => aspetta(300));
    const scorrimento = new Event('touchmove', { bubbles: true, cancelable: true });
    trattieni(scorrimento);
    await act(async () => void dito('pointercancel', document.body, 20, 20));
    const dopo = new Event('touchmove', { bubbles: true, cancelable: true });
    trattieni(dopo);

    expect(scorrimento.defaultPrevented).toBe(true);
    // Deve fallire se: lasciata la carta, la lavagna resta ferma sotto il dito.
    expect(dopo.defaultPrevented).toBe(false);
    expect(document.querySelector('.zr-tocco-ombra, .is-dragging')).toBeNull();
});

it('un tocco breve resta un clic: apre la trattativa, senza presa (TC.4)', async () => {
    posa('d1');
    await act(async () => void dito('pointerup', carta('d1'), 20, 20));
    await act(async () => void carta('d1').click());
    await act(() => aspetta(300));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.zr-tocco-ombra, .is-dragging')).toBeNull();
});

it('il «⋯» della carta resta un comando: tenerlo premuto non prende la carta (TC.5)', async () => {
    premi(dito('pointerdown', carta('d1').querySelector('.zr-card-actions')!, 20, 20));
    await act(() => aspetta(300));

    expect(document.querySelector('.zr-tocco-ombra, .is-dragging')).toBeNull();
});

it('vicino al bordo destro della lavagna, con la carta presa, la lavagna scorre da sola (TC.6)', async () => {
    const lavagna = document.querySelector<HTMLElement>('.zr-lanes')!;
    lavagna.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 390, height: 600 });
    // Il dito si posa a metà della lavagna, lontano dai bordi: lì niente scorre.
    posa('d1', 200, 100);
    await act(() => aspetta(300));
    expect(lavagna.scrollLeft).toBe(0);
    sottoIlDito = colonna('new');
    await act(async () => void dito('pointermove', document.body, 385, 100));
    await act(() => aspetta(100));
    const scorso = lavagna.scrollLeft;
    await act(async () => void dito('pointercancel', document.body, 385, 100));

    // Deve fallire se: la lavagna resta ferma col dito sul bordo (la carta non arriva alle colonne fuori vista).
    expect(scorso).toBeGreaterThan(0);
});

// v4.35.3 (R1 della revisione della v4.35.2): dalla pressione alla fine niente drag del browser sulla carta. Safari su iOS e
// Chrome su Android, col dito fermo più di mezzo secondo, avviano il loro su un elemento `draggable` e si prendono il dito. Il
// DOM finto non conosce `-webkit-user-drag`: si guarda che il pezzo lo scriva e lo tolga (in Chromium lo guarda TC.1).
it('dalla pressione la carta non ha il drag del browser (`-webkit-user-drag: none`), e alla fine lo riprende (R1)', async () => {
    const stile = carta('d1').style;
    const scritto = vi.spyOn(stile, 'setProperty');
    const tolto = vi.spyOn(stile, 'removeProperty');
    posa('d1');

    // Deve fallire se: lo stile arriva solo con la presa (a 250 ms), quando il browser può aver già cominciato.
    expect(scritto).toHaveBeenCalledWith('-webkit-user-drag', 'none');
    expect(tolto).not.toHaveBeenCalledWith('-webkit-user-drag');
    await act(() => aspetta(300));
    await act(async () => void dito('pointerup', document.body, 20, 20));

    expect(tolto).toHaveBeenCalledWith('-webkit-user-drag');
});

// v4.35.3 (R2): la lavagna si aggiorna mentre il dito tiene la carta (la DealPipeline rilegge le fasi ogni 20 s), e la carta
// toccata esce dal documento: il dito non fa scorrere la pagina, e alla fine la carta nuova non resta presa né la colonna accesa.
it('se la lavagna si aggiorna mentre il dito tiene la carta, il dito non fa scorrere la pagina e alla fine niente resta preso (R2)', async () => {
    const toccata = carta('d1');
    premi(dito('pointerdown', toccata, 20, 20));
    await act(() => aspetta(300));
    sottoIlDito = colonna('prop');
    await act(async () => void dito('pointermove', document.body, 200, 40));

    // Un collega ha spostato la trattativa: le fasi nuove la mettono in «Proposta», e React rifà la carta.
    const nuove = [{ ...FASI[0]!, deals: [] }, { ...FASI[1]!, deals: [...FASI[1]!.deals, FASI[0]!.deals[0]!] }];
    await act(async () => radice.render(<DealPipeline stages={nuove} onMove={onMove} onOpen={onOpen} />));
    expect(toccata.isConnected).toBe(false);
    expect(carta('d1').classList.contains('is-dragging')).toBe(true);

    const scorrimento = new Event('touchmove', { bubbles: true, cancelable: true });
    toccata.dispatchEvent(scorrimento);
    sottoIlDito = document.body;
    await act(async () => void dito('pointerup', document.body, 5, 5));

    // Deve fallire se: il touchmove della carta uscita non arriva a nessuno, o il dragend va solo a lei.
    expect(scorrimento.defaultPrevented).toBe(true);
    expect(document.querySelector('.is-dragging, .is-over, .zr-tocco-ombra')).toBeNull();
});
