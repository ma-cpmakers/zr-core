import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { aParte, A_PARTE, leggi } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import { AddressField, type AddressLabels, type AddressPlace, type AddressSuggestion } from './AddressField';
import generato from './AddressField.js?raw';
import * as componenti from './componenti';
import { Zeiras } from './index';

// Sprint 72 · T1 (voce #2454, Decisione 16431). AddressField, arrivato col design system ds-1792851600-0de4, ha un modulo suo
// come MentionField (MentionField.test.tsx): resources/js/zeiras/AddressField.js. Qui: che il file è quello che il bundle genera,
// che non porta niente di MentionField, e che il componente del modulo fa ciò che fa quello di componenti.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const righe = generato.split('\n');
const LUOGHI: AddressSuggestion[] = [
    { id: 'a1', main: 'Arezzo', secondary: 'AR, Italia', kind: 'citta', placeId: 'p-arezzo' },
    { id: 'a2', main: 'Via Roma 4', secondary: 'Arezzo AR, Italia', kind: 'indirizzo' },
    { id: 'a3', main: 'Firenze', secondary: 'FI, Italia', kind: 'citta' },
];
const SCELTO: AddressPlace = { ...(LUOGHI[1] as AddressSuggestion), label: 'Via Roma 4, Arezzo AR, Italia' };
// Gli id vengono da un contatore per modulo: due copie danno numeri diversi, e il confronto li lascia fuori.
const senzaNumeriDegliId = (html: string) => html.replace(/adr-\d+/g, 'adr-N');

describe('il modulo di AddressField è quello che il bundle genera (sprint 72 · T1.3)', () => {
    it('rigenerato in memoria dal bundle il file è uguale, carattere per carattere', () => {
        expect(aParte(leggi(bundle), 'AddressField')).toBe(generato);
    });

    it('con un carattere cambiato nel blocco del bundle non è più uguale', () => {
        const cambiato = bundle.replace("attribution: 'Suggerimenti di Google'", "attribution: 'Suggerimenti di Google!'");

        expect(cambiato).not.toBe(bundle);
        expect(aParte(leggi(cambiato), 'AddressField')).not.toBe(generato);
    });

    it('ha il blocco del bundle riga per riga, dal suo commento alla graffa che chiude la funzione, e le stesse righe private di MentionField', () => {
        const delBundle = bundle.split('\n');
        const inizio = delBundle.findIndex((riga) => riga.startsWith('  /* ---------- AddressField: '));
        // Nel design system di oggi il blocco è di 56 righe: il commento, `ADDRESS_LABELS` e la funzione; sopra il commento c'è
        // quello di MentionField, che non entra.
        const blocco = delBundle.slice(inizio, inizio + 56);
        const daQui = righe.indexOf(blocco[0] ?? '');

        expect([delBundle[inizio - 1]?.startsWith('  /* ---------- MentionField: '), blocco[1]?.startsWith('  var ADDRESS_LABELS = '), blocco[2], blocco.at(-1), delBundle[inizio + 56]]).toStrictEqual([true, true, '  function AddressField(p) {', '  }', '']);
        expect(righe.slice(daQui, daQui + blocco.length)).toStrictEqual(blocco);
        expect(righe.slice(5, daQui - 1)).toStrictEqual(A_PARTE.AddressField);
        expect(A_PARTE.AddressField).toStrictEqual(A_PARTE.MentionField);
        expect(righe.slice(daQui + blocco.length)).toStrictEqual(['', 'export { AddressField };', '']);
    });

    it('da ./componenti prende per nome Icon e Label, e niente altro; di MentionField non porta niente', () => {
        expect(righe.filter((riga) => /\bfrom\b/.test(riga))).toStrictEqual(["import * as React from 'react';", "import { Icon, Label } from './componenti';"]);
        expect(righe.filter((riga) => riga.startsWith('export'))).toStrictEqual(['export { AddressField };']);
        expect(['MentionField', 'MENTION_LABELS', 'zr-mention-chip'].filter((testo) => generato.includes(testo))).toStrictEqual([]);
    });

    it('se il blocco non c\'è, lo script si ferma e dice quale commento manca', () => {
        const senzaCommento = bundle.replace('  /* ---------- AddressField: ', '  /* ---------- Indirizzi: ');

        expect(() => aParte(leggi(senzaCommento), 'AddressField')).toThrow('il commento «/* ---------- AddressField: …», che segna il blocco di AddressField, c\'è 0 volte');
    });
});

describe('l\'AddressField del modulo fa ciò che fa quello di componenti (sprint 72 · T1.2, T1.4)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('da componenti e da window.Zeiras c\'è, con le sue etichette, ed è un altro oggetto', () => {
        expect([typeof componenti.AddressField, Zeiras.AddressField === componenti.AddressField, AddressField === componenti.AddressField, componenti.ADDRESS_LABELS.attribution]).toStrictEqual(['function', true, false, 'Suggerimenti di Google']);
        expect(window.Zeiras.ADDRESS_LABELS).toBe(componenti.ADDRESS_LABELS);
    });

    it('i tipi del modulo sono quelli del design system: le etichette', () => {
        const etichette: AddressLabels = { results: 'Luoghi', empty: 'Nessun luogo' };
        const html = renderToStaticMarkup(createElement(AddressField, { label: 'Indirizzo', suggestions: LUOGHI, labels: etichette, defaultOpen: true, defaultValue: 'zzz' }));

        expect([html.includes('Nessun luogo'), html.includes('aria-label="Luoghi"')]).toStrictEqual([true, true]);
    });

    it.each<[string, Parameters<typeof AddressField>[0]]>([
        ['vuoto, con etichetta e suggerimento', { label: 'Indirizzo', suggestions: LUOGHI, hint: 'Facoltativo' }],
        ['aperto su «are», con «Città», «Indirizzo» e «Suggerimenti di Google»', { label: 'Indirizzo', suggestions: LUOGHI, defaultOpen: true, defaultValue: 'are' }],
        ['testo libero e un errore', { label: 'Indirizzo', suggestions: LUOGHI, defaultValue: 'Piazza Grande', error: 'Scrivi un indirizzo', required: true }],
        ['testo libero senza errore', { label: 'Indirizzo', suggestions: LUOGHI, defaultValue: 'Piazza Grande' }],
        ['con un indirizzo scelto', { label: 'Indirizzo', suggestions: LUOGHI, defaultValue: SCELTO.label, defaultPlace: SCELTO }],
        ['senza attribuzione', { label: 'Indirizzo', suggestions: LUOGHI, defaultOpen: true, defaultValue: 'are', attribution: false }],
    ])('«%s»: lo stesso HTML', (_caso, props) => {
        const html = (componente: (p: typeof props) => ReactElement) => senzaNumeriDegliId(renderToStaticMarkup(createElement(componente, props)));

        expect(html(AddressField)).toContain('zr-address');
        expect(html(AddressField)).toBe(html(componenti.AddressField));
    });

    it('scrivendo «via roma» e scegliendo col tasto Invio, i due danno lo stesso testo, lo stesso luogo e lo stesso HTML', async () => {
        const prova = async (componente: typeof AddressField) => {
            const testi: string[] = [];
            const luoghi: (string | null)[] = [];
            const qui = document.body.appendChild(document.createElement('div'));
            const radice = createRoot(qui);
            await act(async () => radice.render(createElement(componente, { label: 'Indirizzo', suggestions: LUOGHI, onChange: (testo: string) => testi.push(testo), onSelect: (luogo: AddressPlace | null) => luoghi.push(luogo?.label ?? null) })));
            const campo = qui.querySelector('input') as HTMLInputElement;
            await act(async () => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, 'via roma');
                campo.dispatchEvent(new Event('input', { bubbles: true }));
            });
            const opzioni = [...qui.querySelectorAll('[role=option]')].map((opzione) => opzione.textContent);
            await act(async () => {
                campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });
            const dopo = senzaNumeriDegliId(qui.innerHTML);
            await act(async () => radice.unmount());

            return { opzioni, testi, luoghi, dopo };
        };
        const delModulo = await prova(AddressField);

        expect(delModulo.opzioni).toStrictEqual(['Via Roma 4Arezzo AR, ItaliaIndirizzo']);
        expect([delModulo.testi, delModulo.luoghi]).toStrictEqual([['via roma', 'Via Roma 4, Arezzo AR, Italia'], ['Via Roma 4, Arezzo AR, Italia']]);
        expect(delModulo.dopo).toContain('Indirizzo · Via Roma 4, Arezzo AR, Italia');
        expect(delModulo).toStrictEqual(await prova(componenti.AddressField));
    });
});
