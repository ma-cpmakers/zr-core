import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { aParte, A_PARTE, leggi } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import * as componenti from './componenti';
import { MentionField, type MentionOption } from './MentionField';
import generato from './MentionField.js?raw';
import { Zeiras } from './index';

// Sprint 71 · T1 (voce #2433, Decisione 16375). MentionField ha un modulo suo, resources/js/zeiras/MentionField.js: chi lo usa
// solo in una pagina a richiesta lo prende da lì, e il JS d'ingresso non lo porta (lo prova peso.test.ts). Il modulo esce da
// scripts/componenti.mjs come componenti.js: il blocco del bundle riga per riga, le righe private che usa, e i componenti
// registrati presi da ./componenti per nome. Qui: che il file è quello che il bundle genera, che lo script si ferma dove non sa
// portare una riga, e che il componente del modulo fa ciò che fa quello di componenti.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const letto = () => leggi(bundle);
const righe = generato.split('\n');
const AZIENDE: MentionOption[] = [
    { id: 'c1', name: 'Bianchi Arredamenti S.r.l.', sub: 'P. IVA 01234567890 · Arezzo', tag: 'Cliente', tagTone: 'pine' },
    { id: 'c2', name: 'Studio Bianchi & Neri', sub: 'Firenze' },
    { id: 'c3', name: 'Rossi Consulenze S.r.l.', email: 'info@rossi.example' },
];
// Gli id vengono da un contatore per modulo: due copie danno numeri diversi, e il confronto li lascia fuori.
const senzaNumeriDegliId = (html: string) => html.replace(/mnt-\d+/g, 'mnt-N');

describe('il modulo di MentionField è quello che il bundle genera (sprint 71 · T1.3)', () => {
    it('MentionField è l\'unico componente a parte, e rigenerato in memoria dal bundle il file è uguale, carattere per carattere', () => {
        expect(A_PARTE).toStrictEqual(['MentionField']);
        expect(aParte(letto(), 'MentionField')).toBe(generato);
    });

    it('con un carattere cambiato nel blocco del bundle non è più uguale: un bundle riallineato senza rigenerare non passa', () => {
        const cambiato = bundle.replace("create: 'Crea «{q}» nel CRM'", "create: 'Crea «{q}» nel CRM!'");

        expect(cambiato).not.toBe(bundle);
        expect(aParte(leggi(cambiato), 'MentionField')).not.toBe(generato);
    });

    it('ha il blocco del bundle riga per riga, dal commento alla graffa che chiude la funzione, e le righe private che usa, com\'erano', () => {
        const delBundle = bundle.split('\n');
        const inizio = delBundle.findIndex((riga) => riga.startsWith('  /* ---------- MentionField: '));
        const fine = delBundle.indexOf('  }', delBundle.indexOf('  function MentionField(p) {'));
        const blocco = delBundle.slice(inizio, fine + 1);
        const daQui = righe.indexOf(blocco[0] ?? '');

        expect([inizio > 0, fine > inizio, daQui > 0]).toStrictEqual([true, true, true]);
        expect(righe.slice(daQui, daQui + blocco.length)).toStrictEqual(blocco);
        expect(righe.slice(5, daQui - 1)).toStrictEqual([
            '  var h = React.createElement;',
            '  var useState = React.useState;',
            '  var useRef = React.useRef;',
            "  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }",
            "  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }",
        ]);
        expect(righe.slice(5, daQui - 1).every((riga) => delBundle.includes(riga))).toBe(true);
    });

    it('da ./componenti prende per nome tre componenti registrati, e niente altro: né MentionField né una riesportazione', () => {
        expect(righe.filter((riga) => /\bfrom\b/.test(riga))).toStrictEqual(["import * as React from 'react';", "import { Avatar, Icon, Label } from './componenti';"]);
        expect(righe.filter((riga) => riga.startsWith('export'))).toStrictEqual(['export { MentionField };']);
        expect(letto().nomi).toEqual(expect.arrayContaining(['Avatar', 'Icon', 'Label', 'MentionField']));
    });

    it('se il blocco usa una riga privata che non sta tutta su una riga sua, lo script si ferma e dice quale', () => {
        const conUnaRigaSpezzata = bundle.replace('  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(\' \'); }', "  function cx() {\n    return Array.prototype.filter.call(arguments, Boolean).join(' ');\n  }");

        expect(conUnaRigaSpezzata).not.toBe(bundle);
        expect(() => aParte(leggi(conUnaRigaSpezzata), 'MentionField')).toThrow(/MentionField usa «cx», che non sta tutto sulla riga \d+ del bundle/);
    });

    it('se il blocco non c\'è, lo script si ferma e dice quale commento manca', () => {
        const senzaCommento = bundle.replace('  /* ---------- MentionField: ', '  /* ---------- Menzioni: ');

        expect(() => aParte(leggi(senzaCommento), 'MentionField')).toThrow('il commento «/* ---------- MentionField: …», da cui comincia il blocco di MentionField, c\'è 0 volte');
    });
});

describe('il MentionField del modulo fa ciò che fa quello di componenti (sprint 71 · T1.2, T1.4)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('da componenti e da window.Zeiras resta, ed è un altro oggetto: la copia di componenti non è cambiata', () => {
        expect([typeof componenti.MentionField, Zeiras.MentionField === componenti.MentionField, MentionField === componenti.MentionField]).toStrictEqual(['function', true, false]);
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
