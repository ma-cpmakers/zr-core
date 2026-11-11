import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { AddressField, type AddressLabels, type AddressPlace, type AddressSuggestion } from './AddressField';
import * as componenti from './componenti';
import { Zeiras } from './index';
// Sprint 72 · T1 (voce #2454, Decisione 16431). AddressField, arrivato col design system ds-1792851600-0de4, ha un modulo suo
// come MentionField (MentionField.test.tsx): resources/js/zeiras/AddressField.js. Dalla `v4.30.0` (voce #3511) è lo stesso oggetto
// di componenti.js, e che il file sia quello che il bundle genera lo prova componenti.test.ts. Qui: che il componente del modulo fa
// ciò che fa quello di componenti.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LUOGHI: AddressSuggestion[] = [
    { id: 'a1', main: 'Arezzo', secondary: 'AR, Italia', kind: 'citta', placeId: 'p-arezzo' },
    { id: 'a2', main: 'Via Roma 4', secondary: 'Arezzo AR, Italia', kind: 'indirizzo' },
    { id: 'a3', main: 'Firenze', secondary: 'FI, Italia', kind: 'citta' },
];
const SCELTO: AddressPlace = { ...(LUOGHI[1] as AddressSuggestion), label: 'Via Roma 4, Arezzo AR, Italia' };
// Gli id vengono da un contatore: due disegni danno numeri diversi, e il confronto li lascia fuori.
const senzaNumeriDegliId = (html: string) => html.replace(/adr-\d+/g, 'adr-N');

describe('l\'AddressField del modulo fa ciò che fa quello di componenti (sprint 72 · T1.2, T1.4)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('da componenti e da window.Zeiras c\'è, con le sue etichette, ed è lo stesso oggetto del modulo (voce 3511)', () => {
        expect([typeof componenti.AddressField, Zeiras.AddressField === componenti.AddressField, AddressField === componenti.AddressField, componenti.ADDRESS_LABELS.attribution]).toStrictEqual(['function', true, true, 'Suggerimenti di Google']);
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
