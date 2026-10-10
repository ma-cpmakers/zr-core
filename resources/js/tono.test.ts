import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ShellWorkspace } from '../zeiras/index';
import { tonoDelWorkspace } from './index';

// Sprint 17 · T4 (voce #1633). Il tono di un workspace lo decide una regola dall'id del workspace, ed è il nome di uno dei toni
// che il design system ammette per il pallino di un workspace (`ShellWorkspace.tone`). Le attese sono scritte qui una per una,
// calcolate fuori da zr-core: i prodotti installano versioni diverse del pacchetto, e se la regola cambiasse lo stesso workspace
// avrebbe un colore in un prodotto e un altro in quello accanto.

describe('il tono di un workspace', () => {
    it.each([
        // Due id come li dà il backoffice, e uno che cambia solo nell'ultimo carattere.
        ['01k6r3a7c2e6g0j4m8p2s6v0x4', 'pine'],
        ['01k6r3a7c2e6g0j4m8p2s6v0x5', 'citrus'],
        ['01k6r5b8e3g7j1m5q9t3w7y1a5', 'citrus'],
        ['1', 'plum'],
        ['3', 'coral'],
        ['5', 'sky'],
        ['ws-7', 'pine'],
        // Un carattere fuori dal piano di base conta una volta sola, col suo code point: non due mezze coppie, né i suoi byte.
        ['😀', 'plum'],
        ['x😀', 'sky'],
    ])('l\'id «%s» ha il tono %s, a ogni chiamata (sprint 17 · T4.1, T4.6)', (id, tono) => {
        expect(tonoDelWorkspace(id)).toBe(tono);
        expect(tonoDelWorkspace(id)).toBe(tono);
    });

    it('su cento id di prova la regola dà tutti e cinque i toni e nessun altro valore (sprint 17 · T4.2)', () => {
        const quanti: Record<string, number> = {};
        for (let numero = 1; numero <= 100; numero++) {
            const tono = String(tonoDelWorkspace(String(numero)));
            quanti[tono] = (quanti[tono] ?? 0) + 1;
        }

        expect(quanti).toStrictEqual({ pine: 21, citrus: 21, coral: 21, sky: 17, plum: 20 });
    });

    it('ciò che dà è ciò che il selettore del design system accetta come tono di un workspace, né più né meno: lo guarda tsc (sprint 17 · T4.2)', () => {
        expectTypeOf(tonoDelWorkspace).returns.toEqualTypeOf<ShellWorkspace['tone']>();
    });

    it.each([
        ['vuoto', ''],
        ['che manca', undefined],
        ['che non è un testo', 5 as unknown as string],
        ['null', null as unknown as string],
    ])('un id %s non ha tono (sprint 17 · T4.4)', (_caso, id) => {
        expect(tonoDelWorkspace(id)).toBeUndefined();
    });
});
