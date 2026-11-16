import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { premi } from './tocco';
import { KanbanBoard } from './zeiras/componenti';

// v4.36.0 (richiesta 294, voce 3913; zr-pm-74 16/11): le schede della KanbanBoard col dito, come le carte della DealPipeline
// dalla v4.35.2 (tocco.test.tsx). Il DOM finto non ha la geometria: dove sta il dito lo dice `elementFromPoint`, che qui
// risponde con l'elemento scelto dal caso. Lo scorrimento al bordo, che è della board, lo provano le righe TK di uat-cornice.

const LISTE = [
    { id: 'todo', title: 'Da fare', cards: [{ id: 'k1', title: 'Preventivo' }, { id: 'k2', title: 'Aula' }] },
    { id: 'doing', title: 'In corso', cards: [{ id: 'k3', title: 'Docenti' }] },
    { id: 'chiusa', title: 'Chiusa', cards: [] },
];
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aspetta = (ms: number) => new Promise((fatto) => setTimeout(fatto, ms));

let radice: Root;
let contenitore: HTMLElement;
let sottoIlDito: Element | null;
const onMove = vi.fn();
const onOpenCard = vi.fn();
const onRefuse = vi.fn();
const canEnter = (_scheda: unknown, verso: { id: string }) => (verso.id === 'chiusa' ? 'Prima va approvata' : true);

beforeEach(async () => {
    contenitore = document.body.appendChild(document.createElement('div'));
    radice = createRoot(contenitore);
    await act(async () => radice.render(<KanbanBoard lists={LISTE} onMove={onMove} onOpenCard={onOpenCard} onRefuse={onRefuse} canEnter={canEnter} />));
    sottoIlDito = null;
    document.elementFromPoint = () => sottoIlDito;
});

afterEach(async () => {
    await act(async () => radice.unmount());
    contenitore.remove();
    onMove.mockReset();
    onOpenCard.mockReset();
    onRefuse.mockReset();
});

const scheda = (id: string) => document.getElementById(id)!;
const lista = (id: string) => document.querySelector<HTMLElement>(`[data-list-id="${id}"]`)!;
const dito = (tipo: string, dove: Element, x: number, y: number) => {
    const evento = new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y });
    dove.dispatchEvent(evento);

    return evento;
};
/** Il dito si posa sulla scheda: come il pezzo dei rimedi, `premi` riceve il `pointerdown`. */
const posa = (id: string, x = 20, y = 20) => premi(dito('pointerdown', scheda(id), x, y));
const lascia = async (dove: Element, x = 200, y = 40) => {
    sottoIlDito = dove;
    await act(async () => void dito('pointermove', document.body, x, y));
    await act(async () => void dito('pointerup', document.body, x, y));
};

it('una pressione di 250 ms prende la scheda della board: una copia segue il dito, e al rilascio su un\'altra lista onMove la sposta lì (K.1)', async () => {
    expect(scheda('k1').getAttribute('draggable')).toBe('true');
    posa('k1');
    await act(() => aspetta(300));

    const ombra = document.querySelector('.zr-tocco-ombra');
    expect(ombra).not.toBeNull();
    expect(ombra?.getAttribute('aria-hidden')).toBe('true');
    expect(ombra?.hasAttribute('id')).toBe(false);
    expect(scheda('k1').classList.contains('is-dragging')).toBe(true);

    await lascia(lista('doing'));

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({ id: 'k1' });
    expect(onMove.mock.calls[0]?.slice(1)).toStrictEqual(['doing', 'todo', null]);
    expect(document.querySelector('.zr-tocco-ombra')).toBeNull();
    expect(document.querySelector('.zr-card.is-dragging')).toBeNull();
    // Il clic che il browser manda dopo il dito alzato non apre la scheda appena lasciata.
    await act(async () => void scheda('k1').click());
    expect(onOpenCard).not.toHaveBeenCalled();
});

it('rilasciata sopra una scheda di un\'altra lista, la scheda va prima di quella: beforeCardId è la scheda sotto il dito (K.2)', async () => {
    posa('k1');
    await act(() => aspetta(300));
    await lascia(scheda('k3').querySelector('.zr-card-title') ?? scheda('k3'));

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.slice(1)).toStrictEqual(['doing', 'todo', 'k3']);
});

it('il pezzo non scorre di lato la board, che col dito al bordo scorre da sé come col mouse (K.3)', async () => {
    const lavagna = document.querySelector<HTMLElement>('.zr-lanes')!;
    const scritti: number[] = [];
    Object.defineProperty(lavagna, 'scrollLeft', { configurable: true, get: () => 0, set: (valore: number) => void scritti.push(valore) });

    posa('k1');
    await act(() => aspetta(300));
    sottoIlDito = lista('doing');
    // Nel DOM finto la board è larga 0: per il pezzo il dito sta oltre il bordo destro, e una DealPipeline scorrerebbe.
    await act(async () => void dito('pointermove', document.body, 200, 40));
    await act(() => aspetta(100));

    expect(scritti).toStrictEqual([]);
    await act(async () => void dito('pointerup', document.body, 200, 40));
});

it('un dito che si muove prima dei 250 ms non prende la scheda, e un tocco breve resta un clic che la apre (K.4)', async () => {
    posa('k1');
    await act(async () => void dito('pointermove', document.body, 20, 80));
    await act(() => aspetta(300));
    expect(document.querySelector('.zr-tocco-ombra')).toBeNull();
    expect(document.querySelector('.zr-card.is-dragging')).toBeNull();

    posa('k2');
    await act(async () => void dito('pointerup', document.body, 20, 20));
    await act(() => aspetta(300));
    await act(async () => void scheda('k2').click());

    expect(document.querySelector('.zr-tocco-ombra')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
    expect(onOpenCard).toHaveBeenCalledTimes(1);
    expect(onOpenCard.mock.calls[0]?.[0]).toMatchObject({ id: 'k2' });
});

it('una lista che rifiuta la scheda non la riceve col dito, e onRefuse arriva come col mouse (K.5)', async () => {
    posa('k1');
    await act(() => aspetta(300));
    await lascia(lista('chiusa'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onRefuse).toHaveBeenCalledTimes(1);
    expect(onRefuse.mock.calls[0]?.[0]).toMatchObject({ id: 'k1' });
    expect(onRefuse.mock.calls[0]?.slice(1)).toStrictEqual([expect.objectContaining({ id: 'chiusa' }), 'Prima va approvata']);
    expect(lista('todo').contains(scheda('k1'))).toBe(true);
});
