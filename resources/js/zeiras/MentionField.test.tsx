import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import * as componenti from './componenti';
import { MentionField, type MentionLabels, type MentionOption } from './MentionField';
import { Zeiras } from './index';
// Sprint 71 · T1 (voce #2433, Decisione 16375). MentionField ha un modulo suo, resources/js/zeiras/MentionField.js: chi lo usa
// solo in una pagina a richiesta lo prende da lì, e il JS d'ingresso non lo porta (lo prova peso.test.ts). Dalla `v4.30.0` (voce
// #3511) ogni componente ha un modulo suo, e quello di componenti.js è lo stesso oggetto: che i file siano quelli che il bundle
// genera lo prova componenti.test.ts per tutti. Qui: che il componente del modulo fa ciò che fa quello di componenti.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AZIENDE: MentionOption[] = [
    { id: 'c1', name: 'Bianchi Arredamenti S.r.l.', sub: 'P. IVA 01234567890 · Arezzo', tag: 'Cliente', tagTone: 'pine' },
    { id: 'c2', name: 'Studio Bianchi & Neri', sub: 'Firenze' },
    { id: 'c3', name: 'Rossi Consulenze S.r.l.', email: 'info@rossi.example' },
];
// Gli id vengono da un contatore: due disegni danno numeri diversi, e il confronto li lascia fuori.
const senzaNumeriDegliId = (html: string) => html.replace(/mnt-\d+/g, 'mnt-N');

describe('il MentionField del modulo fa ciò che fa quello di componenti (sprint 71 · T1.2, T1.4)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('da componenti e da window.Zeiras resta, ed è lo stesso oggetto del modulo: una copia sola (voce 3511)', () => {
        expect([typeof componenti.MentionField, Zeiras.MentionField === componenti.MentionField, MentionField === componenti.MentionField]).toStrictEqual(['function', true, true]);
    });

    it('i tipi del modulo sono quelli del design system: le etichette e le opzioni', () => {
        const etichette: MentionLabels = { results: 'Aziende del CRM', empty: 'Nessuna azienda con questo nome', remove: 'Togli' };
        const html = renderToStaticMarkup(createElement(MentionField, { label: 'Azienda', suggestions: AZIENDE, labels: etichette, defaultOpen: true, defaultQuery: 'zzz' }));

        expect([html.includes('Nessuna azienda con questo nome'), html.includes('aria-label="Aziende del CRM"')]).toStrictEqual([true, true]);
    });

    it.each<[string, Parameters<typeof MentionField>[0]]>([
        ['vuoto, con etichetta e suggerimento', { label: 'Azienda', suggestions: AZIENDE, hint: 'Facoltativa' }],
        ['con un valore e un errore', { label: 'Azienda', suggestions: AZIENDE, value: [AZIENDE[0] as MentionOption], error: 'Scegline una', required: true }],
        ['aperto su «@bianchi», con «Crea»', { label: 'Azienda', suggestions: AZIENDE, multiple: false, defaultOpen: true, defaultQuery: 'bianchi', onCreate: () => undefined, createLabel: 'Crea l\'azienda «{q}»' }],
        ['aperto su una parola che non c\'è', { label: 'Azienda', suggestions: AZIENDE, defaultOpen: true, defaultQuery: 'zzz' }],
    ])('«%s»: lo stesso HTML', (_caso, props) => {
        const html = (componente: (p: typeof props) => ReactElement) => senzaNumeriDegliId(renderToStaticMarkup(createElement(componente, props)));

        expect(html(MentionField)).toContain('zr-mention');
        expect(html(MentionField)).toBe(html(componenti.MentionField));
    });

    it('scrivendo «@ros» e scegliendo col tasto Invio, i due danno lo stesso valore e lo stesso HTML', async () => {
        const prova = async (componente: typeof MentionField) => {
            const scelti: MentionOption[][] = [];
            const qui = document.body.appendChild(document.createElement('div'));
            const radice = createRoot(qui);
            await act(async () => radice.render(createElement(componente, { label: 'Azienda', suggestions: AZIENDE, multiple: false, onChange: (valore: MentionOption[]) => scelti.push(valore) })));
            const campo = qui.querySelector('input') as HTMLInputElement;
            await act(async () => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, '@ros');
                campo.dispatchEvent(new Event('input', { bubbles: true }));
            });
            const opzioni = [...qui.querySelectorAll('[role=option]')].map((opzione) => opzione.textContent);
            await act(async () => {
                campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });
            const dopo = senzaNumeriDegliId(qui.innerHTML);
            await act(async () => radice.unmount());

            return { opzioni, scelti: scelti.map((valore) => valore.map((uno) => uno.id)), dopo };
        };
        const delModulo = await prova(MentionField);

        expect(delModulo.opzioni).toStrictEqual(['RSRossi Consulenze S.r.l.info@rossi.example']);
        expect(delModulo.scelti).toStrictEqual([['c3']]);
        expect(delModulo).toStrictEqual(await prova(componenti.MentionField));
    });
});
