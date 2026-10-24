import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { aParte, A_PARTE, leggi } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import * as componenti from './componenti';
import { MentionField, type MentionLabels, type MentionOption } from './MentionField';
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
    it('MentionField e AddressField (dalla `v3.2.0`) sono i componenti a parte, e rigenerato in memoria dal bundle il file è uguale, carattere per carattere', () => {
        expect(Object.keys(A_PARTE)).toStrictEqual(['MentionField', 'AddressField']);
        expect(aParte(letto(), 'MentionField')).toBe(generato);
    });

    it('con un carattere cambiato nel blocco del bundle non è più uguale: un bundle riallineato senza rigenerare non passa', () => {
        const cambiato = bundle.replace("create: 'Crea «{q}» nel CRM'", "create: 'Crea «{q}» nel CRM!'");

        expect(cambiato).not.toBe(bundle);
        expect(aParte(leggi(cambiato), 'MentionField')).not.toBe(generato);
    });

    // Sprint 72 · T1.3 (voce #2454): nel design system ds-1792851600-0de4 il blocco di AddressField sta fra il commento di
    // MentionField e la sua funzione. Il blocco di un componente comincia dalla funzione e risale alle righe che le stanno
    // attaccate (le sue `var`, il suo commento): fino a una riga vuota, a una chiusura o al commento di un altro componente.
    it('ha il blocco del bundle riga per riga, dalle righe attaccate alla funzione alla graffa che la chiude, e le righe private che usa, com\'erano', () => {
        const delBundle = bundle.split('\n');
        const funzione = delBundle.indexOf('  function MentionField(p) {');
        // Nel design system di oggi il blocco è di 64 righe: `MENTION_LABELS` e la funzione; prima una riga vuota, dopo la sua
        // graffa il bundle va a capo e comincia Checkbox.
        const inizio = funzione - 1;
        const blocco = delBundle.slice(inizio, inizio + 64);
        const daQui = righe.indexOf(blocco[0] ?? '');

        expect([delBundle[inizio - 1], blocco[0]?.startsWith('  var MENTION_LABELS = '), daQui > 0, blocco.at(-1), delBundle[inizio + 64], delBundle[inizio + 65]]).toStrictEqual(['', true, true, '  }', '', '  function Checkbox(p) {']);
        expect(righe.slice(daQui, daQui + blocco.length)).toStrictEqual(blocco);
        expect(righe.slice(5, daQui - 1)).toStrictEqual([
            '  var h = React.createElement;',
            '  var useState = React.useState;',
            '  var useRef = React.useRef;',
            "  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }",
            "  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }",
        ]);
        expect(righe.slice(5, daQui - 1)).toStrictEqual(A_PARTE.MentionField);
        expect(righe.slice(daQui + blocco.length)).toStrictEqual(['', 'export { MentionField };', '']);
        expect(righe.slice(5, daQui - 1).every((riga) => delBundle.includes(riga))).toBe(true);
    });

    it('non porta niente del blocco di AddressField, che nel bundle sta fra il suo commento e la sua funzione (sprint 72 · T1.3)', () => {
        const delBundle = bundle.split('\n');
        const commento = delBundle.findIndex((riga) => riga.startsWith('  /* ---------- MentionField: '));

        expect([delBundle[commento + 1]?.startsWith('  /* ---------- AddressField: '), commento < delBundle.indexOf('  function AddressField(p) {'), delBundle.indexOf('  function AddressField(p) {') < delBundle.indexOf('  function MentionField(p) {')]).toStrictEqual([true, true, true]);
        expect(['zr-address', 'ADDRESS_LABELS', 'AddressField', '/* ---------- '].filter((testo) => generato.includes(testo))).toStrictEqual([]);
        // Una riga di meno della `v3.1.0` (79 col fondo): il commento di MentionField, che non sta più attaccato alla funzione.
        expect(righe.length).toBe(78);
    });

    it('col commento attaccato alla funzione, come nel design system di prima, il blocco comincia dal commento', () => {
        const delBundle = bundle.split('\n');
        const commento = delBundle.findIndex((riga) => riga.startsWith('  /* ---------- MentionField: '));
        const rigaDelCommento = delBundle[commento] ?? '';
        delBundle.splice(commento, 1);
        delBundle.splice(delBundle.indexOf('  function MentionField(p) {') - 1, 0, rigaDelCommento);
        const modulo = aParte(leggi(delBundle.join('\n')), 'MentionField').split('\n');

        expect(modulo.slice(modulo.indexOf(rigaDelCommento) - 1, modulo.indexOf(rigaDelCommento) + 3).map((riga) => riga.slice(0, 24))).toStrictEqual(['', rigaDelCommento.slice(0, 24), '  var MENTION_LABELS = {', '  function MentionField(']);
    });

    it('da ./componenti prende per nome tre componenti registrati, e niente altro: né MentionField né una riesportazione', () => {
        expect(righe.filter((riga) => /\bfrom\b/.test(riga))).toStrictEqual(["import * as React from 'react';", "import { Avatar, Icon, Label } from './componenti';"]);
        expect(righe.filter((riga) => riga.startsWith('export'))).toStrictEqual(['export { MentionField };']);
        expect(letto().nomi).toEqual(expect.arrayContaining(['Avatar', 'Icon', 'Label', 'MentionField']));
    });

    it('se il blocco usa una riga privata che non sta tutta su una riga sua, lo script si ferma e dice quale', () => {
        const conUnaRigaSpezzata = bundle.replace('  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(\' \'); }', "  function cx() {\n    return Array.prototype.filter.call(arguments, Boolean).join(' ');\n  }");

        expect(conUnaRigaSpezzata).not.toBe(bundle);
        expect(() => aParte(leggi(conUnaRigaSpezzata), 'MentionField')).toThrow('MentionField usa «cx», dichiarato alla riga 8 del bundle, e la riga non è fra le righe private che lo script porta nel suo modulo (A_PARTE)');
    });

    // Lettura della PR #126 (rilievi 1, 3, 4, 5): un nome che il blocco usa, dichiarato in una forma che lo script non legge,
    // sparirebbe dal modulo senza errore; ciò che il bundle dice di MentionField fuori dal blocco non entrerebbe; una funzione
    // chiusa da «};» prenderebbe la chiusura di Checkbox. Ognuna ferma lo script.
    const RIGA_DI_USEREF = '  var useRef = React.useRef;';
    const RIGA_DI_CX = "  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }";
    it.each<[string, (testo: string) => string, string]>([
        ['due nomi con la virgola', (testo) => testo.replace(RIGA_DI_USEREF, '  var a = 1, useRef = React.useRef;'), 'la riga 6 dichiara più nomi con la virgola'],
        ['un nome fra graffe', (testo) => testo.replace(RIGA_DI_USEREF, '  var { useRef } = React;'), 'la riga 6 («var { useRef } = React;») ha una forma che lo script non conosce'],
        ['un `const`', (testo) => testo.replace(RIGA_DI_USEREF, '  const useRef = React.useRef;'), 'la riga 6 («const useRef = React.useRef;») ha una forma che lo script non conosce'],
        ['un\'espressione regolare con una parentesi prima di un\'altra dichiarazione', (testo) => testo.replace(RIGA_DI_CX, `  var RX = /[(]/; ${RIGA_DI_CX.trim()}`), 'le graffe della dichiarazione della riga 8 non si chiudono dove comincia la riga seguente col rientro del bundle'],
        ['una proprietà data a MentionField dopo il blocco', (testo) => testo.replace('  function Checkbox(p) {', '  MentionField.Prova = Avatar;\n  function Checkbox(p) {'), 'dà una proprietà a MentionField, che il modulo di MentionField porta'],
        ['un nome dato a MentionField con un testo', (testo) => testo.replace('  function Checkbox(p) {', "  MentionField.displayName = 'M';\n  function Checkbox(p) {"), '(«MentionField.displayName = \'M\';») ha una forma che lo script non conosce'],
        ['la funzione chiusa da «};»', (testo) => {
            const delBundle = testo.split('\n');
            delBundle[delBundle.indexOf('  }', delBundle.indexOf('  function MentionField(p) {'))] = '  };';

            return delBundle.join('\n');
        }, 'la funzione MentionField non si chiude con una riga «}»'],
        // Seconda lettura della PR #126: le stesse cose su una riga `function`, sulla riga che continua una `var`, su un nome
        // privato che il modulo porta, e con un apostrofo in un commento.
        ['una riga `function` con due nomi dopo', (testo) => testo.replace(RIGA_DI_USEREF, '  function rr() {} var zz = 1, useRef = React.useRef;'), 'la riga 6 dichiara più nomi con la virgola'],
        ['una riga `function` con un\'espressione regolare con una parentesi', (testo) => testo.replace(RIGA_DI_USEREF, '  function rr() { return /[(]/; } var useRef = React.useRef;'), 'le graffe della dichiarazione della riga 6 non si chiudono'],
        ['un secondo nome sulla riga che continua una `var`', (testo) => testo.replace(RIGA_DI_USEREF, '  var zq9 = [1,\n    2], useRef = React.useRef;'), 'la riga 6 dichiara più nomi con la virgola'],
        ['una proprietà data a una riga privata', (testo) => testo.replace('  function Checkbox(p) {', '  cx.sep = Avatar;\n  function Checkbox(p) {'), 'dà una proprietà a cx, che il modulo di MentionField porta'],
        ['un apostrofo in un commento su una riga privata', (testo) => testo.replace(RIGA_DI_USEREF, "  var useRef = React.useRef; /* l'id */"), 'MentionField usa «useRef», dichiarato alla riga 6 del bundle, e la riga non è fra le righe private'],
        ['una riga privata nuova', (testo) => testo.replace('    var id = useId(\'mnt\');', '    var id = useId(\'mnt\'); var w = useWidth();'), 'MentionField usa «useWidth», dichiarato alla riga'],
    ])('con %s lo script si ferma e dice dove', (_caso, cambia, detto) => {
        const cambiato = cambia(bundle);

        expect(cambiato).not.toBe(bundle);
        expect(() => aParte(leggi(cambiato), 'MentionField')).toThrow(detto);
    });

    it('se il blocco non usa più una riga privata dell\'elenco, lo script si ferma: l\'elenco va riallineato', () => {
        const senzaCx = bundle.replace("className: cx('zr-field', 'zr-mention', p.error && 'is-error', p.className)", "className: 'zr-field zr-mention'").replaceAll("className: cx('zr-mention-opt', i === active && 'is-active')", "className: 'zr-mention-opt'").replace("className: cx('zr-mention-opt', 'is-create', active === list.length && 'is-active')", "className: 'zr-mention-opt is-create'");

        expect(senzaCx).not.toBe(bundle);
        expect(() => aParte(leggi(senzaCx), 'MentionField')).toThrow('la riga privata «function cx() { return Array.prototype.filter.call(arguments» dell\'elenco di MentionField (A_PARTE) non c\'è più nel bundle, o MentionField non la usa più');
    });

    it('se il blocco non c\'è, lo script si ferma e dice quale commento manca', () => {
        const senzaCommento = bundle.replace('  /* ---------- MentionField: ', '  /* ---------- Menzioni: ');

        expect(() => aParte(leggi(senzaCommento), 'MentionField')).toThrow('il commento «/* ---------- MentionField: …», che segna il blocco di MentionField, c\'è 0 volte');
    });

    // Lettura della PR #128 (rilievi 1-4): la risalita dalla funzione prende solo righe sue, e dove non sa dire di chi è una
    // riga si ferma invece di prenderla o perderla in silenzio.
    const RIGA_DI_USEID = "  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }";
    it.each<[string, (testo: string) => string]>([
        ['una `var` con uno stato attaccata sopra le etichette, che MentionField non usa', (testo) => testo.replace('\n  var MENTION_LABELS = ', '\n  var cache = new Map();\n  var MENTION_LABELS = ')],
        ['la funzione di AddressField chiusa senza riga vuota prima delle etichette', (testo) => testo.replace('  }\n\n  var MENTION_LABELS = ', '  }\n  var MENTION_LABELS = ')],
    ])('con %s il modulo è lo stesso', (_caso, cambia) => {
        const cambiato = cambia(bundle);

        expect(cambiato).not.toBe(bundle);
        expect(aParte(leggi(cambiato), 'MentionField')).toBe(generato);
    });

    it.each<[string, string, (testo: string) => string, string]>([
        ['una `var` con uno stato fra i due commenti, che AddressField usa', 'AddressField', (testo) => testo.replace("  /* ---------- AddressField: ", "  var SHARED = React.createContext(null);\n  /* ---------- AddressField: ").replace("    var id = useId('adr');", "    var id = useId('adr'); var ctx = React.useContext(SHARED);"), 'AddressField usa «SHARED», dichiarato alla riga'],
        ['una `var` con uno stato attaccata sopra le etichette, che usano AddressField e un altro', 'AddressField', (testo) => testo.replace('\n  var ADDRESS_LABELS = ', '\n  var SHARED = React.createContext(null);\n  var ADDRESS_LABELS = ').replace("    var id = useId('adr');", "    var id = useId('adr'); var ctx = React.useContext(SHARED);").replace('  function Checkbox(p) {', '  function Checkbox(p) { var c = React.useContext(SHARED);'), 'sta attaccata alla funzione AddressField e dichiara «SHARED», che usa anche il resto del bundle'],
        ['le etichette su più righe, chiuse da «};»', 'MentionField', (testo) => testo.replace("  var MENTION_LABELS = { remove: 'Togli', ", "  var MENTION_LABELS = {\n    remove: 'Togli',\n    ").replace("results: 'Clienti del CRM' };", "results: 'Clienti del CRM'\n  };"), 'MentionField usa «MENTION_LABELS», che il bundle registra ma non è un componente, dichiarato alla riga'],
        ['una `function` attaccata sopra le etichette, che MentionField usa', 'MentionField', (testo) => testo.replace('\n  var MENTION_LABELS = ', '\n  function fmt(x) { return x; }\n  var MENTION_LABELS = ').replace("    var id = useId('mnt');", "    var id = fmt(useId('mnt'));"), 'MentionField usa «fmt», dichiarato alla riga'],
        ['la riga di useId attaccata sopra la funzione', 'MentionField', (testo) => testo.replace(`${RIGA_DI_USEID}\n`, '').replace('  function MentionField(p) {', `${RIGA_DI_USEID}\n  function MentionField(p) {`), 'sta attaccata alla funzione MentionField e dichiara «uid», che usa anche il resto del bundle'],
    ])('con %s lo script si ferma e dice perché', (_caso, nome, cambia, detto) => {
        const cambiato = cambia(bundle);

        expect(cambiato).not.toBe(bundle);
        expect(() => aParte(leggi(cambiato), nome)).toThrow(detto);
    });
});

describe('il MentionField del modulo fa ciò che fa quello di componenti (sprint 71 · T1.2, T1.4)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('da componenti e da window.Zeiras resta, ed è un altro oggetto: la copia di componenti non è cambiata', () => {
        expect([typeof componenti.MentionField, Zeiras.MentionField === componenti.MentionField, MentionField === componenti.MentionField]).toStrictEqual(['function', true, false]);
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
