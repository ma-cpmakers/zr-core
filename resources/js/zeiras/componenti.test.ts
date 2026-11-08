import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dividiIlCss, genera, leggi, moduli } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import dichiarazioni from '../../zeiras/index.d.ts?raw';
import * as componenti from './componenti';
import { Zeiras } from './index';

// Sprint 25 · T1 (voce #1759). I componenti del design system come moduli ES: escono da scripts/componenti.mjs, che prende il
// corpo di resources/zeiras/bundle.js riga per riga e ne esporta per nome ciò che il bundle registra in `window.Zeiras`. Dalla
// `v4.28.0` (voce #3511) un modulo per nome, resources/js/zeiras/<Nome>.js, le righe private comuni in interni/, e `componenti.js`
// che li esporta soltanto. La cornice e `Zeiras` li prendono da lì: una copia sola del design system per app. Il bundle, le
// dichiarazioni e i file generati si leggono qui come testo (`?raw`), senza `node:fs`. Ciò che i file devono contenere è scritto
// qui senza passare dallo script: rigenerarli con lo stesso script non vedrebbe uno script cambiato.

const INIZIO_DELLA_REGISTRAZIONE = '  window.Zeiras = Object.assign(window.Zeiras || {}, {';
const righeDelBundle = bundle.split('\n');
const rigaDellaRegistrazione = righeDelBundle.indexOf(INIZIO_DELLA_REGISTRAZIONE);
// I file generati, per percorso da resources/js/zeiras (`componenti.js`, `Button.js`, `interni/h.js`), e i moduli che danno.
const testi = Object.fromEntries(Object.entries(import.meta.glob<string>(['./*.js', './interni/*.js'], { query: '?raw', import: 'default', eager: true })).map(([percorso, testo]) => [percorso.slice(2), testo]));
const caricati = Object.fromEntries(Object.entries(import.meta.glob<Record<string, unknown>>(['./*.js', './interni/*.js'], { eager: true })).map(([percorso, modulo]) => [percorso.slice(2), modulo]));
const generato = testi['componenti.js'] ?? '';
// Il CSS col suo testo: in vitest un `import` di un CSS, anche con `?raw`, non lo dà.
const css = readFileSync(resolve('resources/zeiras/bundle.css'), 'utf8');

/** I nomi che il bundle registra in `window.Zeiras`, nell'ordine in cui li registra. */
function nomiRegistrati(): string[] {
    const fine = righeDelBundle.indexOf('  });', rigaDellaRegistrazione);

    return righeDelBundle
        .slice(rigaDellaRegistrazione + 1, fine)
        .join(' ')
        .split(',')
        .map((coppia) => (coppia.split(':')[0] ?? '').trim())
        .filter((nome) => nome !== '');
}

/** I nomi degli `export declare` di resources/zeiras/index.d.ts. */
function nomiDichiarati(): string[] {
    return [...dichiarazioni.matchAll(/^export declare (?:function|const) ([A-Za-z_$][\w$]*)/gm)].map((trovato) => trovato[1] ?? '');
}

/** Le righe del bundle di un modulo generato: dopo il commento e gli import, prima dell'`export` in fondo. */
function corpoDi(testo: string): string[] {
    const righe = testo.split('\n');
    const inizio = righe.indexOf('') + 1;
    const fine = righe.at(-2)?.startsWith('export {') ? righe.length - 3 : righe.length - 1;

    return righe.slice(inizio, fine);
}

const come = (oggetto: object) => oggetto as Record<string, unknown>;

// Sprint 50 · T1 (voce 2073). Le tre righe del bundle che il modulo segna pure, con ciò che va davanti al segno: i dati di esempio
// di `CrmContacts` e i due formattatori dei numeri, che usano solo componenti che la cornice non usa. Scritte qui, non prese dallo
// script.
const SEGNATE = ['  var NF = ', '  var EUR = ', '  var SAMPLE_CONTACTS = '];
const PURO = '/* @__PURE__ */ ';

/** La riga del bundle com'è nel modulo: una delle tre col segno dopo l'uguale, le altre uguali. */
function nelModulo(riga: string): string {
    const segnata = SEGNATE.find((inizio) => riga.startsWith(inizio));

    return segnata === undefined ? riga : segnata + PURO + riga.slice(segnata.length);
}

/** Le righe non vuote, in ordine, per confrontarle come insieme con ripetizioni. */
const ordinate = (righe: string[]) => righe.filter((riga) => riga.trim() !== '').sort();

describe('i file generati sono quelli che il bundle genera (T1.1; voce 3511 · AC 4)', () => {
    it('rigenerati in memoria dal bundle sono uguali ai file, carattere per carattere, e non ce n\'è uno in più né uno in meno', () => {
        const rigenerati = moduli(leggi(bundle), dividiIlCss(css));

        expect(Object.keys(testi).sort()).toEqual(Object.keys(rigenerati).sort());
        for (const [percorso, testo] of Object.entries(rigenerati)) {
            expect(testi[percorso], percorso).toBe(testo);
        }
    });

    it('con un carattere cambiato nel bundle un modulo non è più uguale: un bundle riallineato senza rigenerare non passa', () => {
        const cambiato = bundle.replace("p.label || 'Percorso'", "p.label || 'Percorsi'");

        expect(cambiato).not.toBe(bundle);
        expect(Object.entries(moduli(leggi(cambiato), dividiIlCss(css))).filter(([percorso, testo]) => testi[percorso] !== testo).map(([percorso]) => percorso)).toEqual(['Breadcrumb.js']);
    });

    it('componenti.js ha il commento che dice da dove esce e poi solo un `export … from` per nome registrato, dal suo modulo', () => {
        const righe = generato.split('\n');
        const esportazioni = righe.filter((riga) => !riga.startsWith('//') && riga !== '');

        expect(righe[0]).toBe('// Generato da scripts/componenti.mjs: non si ritocca a mano.');
        expect(esportazioni.map((riga) => /^export \{ (\w+) \} from '\.\/(\w+)';$/.exec(riga)?.slice(1))).toEqual(esportazioni.map(() => expect.any(Array)));
        expect(esportazioni.map((riga) => /^export \{ (\w+) \} from '\.\/(\w+)';$/.exec(riga)).every((trovato) => trovato?.[1] === trovato?.[2])).toBe(true);
        expect(esportazioni.map((riga) => /^export \{ (\w+) \}/.exec(riga)?.[1]).sort()).toEqual([...nomiRegistrati()].sort());
    });

    it('ogni riga del corpo del bundle sta in un modulo solo: nessuna è copiata in due, nessuna manca, e i moduli non leggono la finestra (voce 3511 · AC 3)', () => {
        const delCorpo = righeDelBundle.slice(3, rigaDellaRegistrazione).map(nelModulo);
        const neiModuli = Object.entries(testi).filter(([percorso]) => percorso !== 'componenti.js').flatMap(([, testo]) => corpoDi(testo));

        expect(rigaDellaRegistrazione).toBeGreaterThan(3);
        expect(ordinate(neiModuli)).toEqual(ordinate(delCorpo));
        expect(Object.values(testi).join('\n')).not.toMatch(/window\.(React|Zeiras)\b/);
    });
});

// Voce #3511 (revisione, R1): le fermate della divisione in moduli, ognuna su un corpo finto di poche righe (il corpo comincia
// alla riga 4 del bundle). Quella del giro è la sola difesa contro una `var` letta appena caricato il modulo, in un giro di
// import, prima di esistere.
describe('davanti a un corpo che non sa dividere lo script si ferma e dice perché (voce 3511)', () => {
    it.each<[string, string[], string[], RegExp]>([
        ['un nome dichiarato due volte', ['  function A() {}', '  function A() {}'], ['A'], /«A» è dichiarato due volte \(righe 4 e 5\)/],
        ['una proprietà data a un nome che il corpo non dichiara', ['  function A() {}', '  B.x = A;'], ['A'], /la riga 5 dà una proprietà a «B», che il corpo del bundle non dichiara/],
        ['due nomi registrati che danno un valore allo stesso nome', ['  var n = 0;', '  function A() { n += 1; }', '  function B() { n += 1; }'], ['A', 'B'], /dichiarano due nomi registrati e devono stare nello stesso modulo/],
        ['due nomi registrati con lo stesso file', ['  function Ab() {}', '  function AB() {}'], ['Ab', 'AB'], /due moduli avrebbero lo stesso file, AB\.js/],
        ['un nome registrato col file di componenti.js', ['  function componenti() {}'], ['componenti'], /due moduli avrebbero lo stesso file, componenti\.js/],
        ['una var letta appena caricato da un modulo che lei importa', ['  function A() { return y; }', '  var y = B.k;', '  var B = { k: 1, a: function () { return A; } };'], ['A', 'B'], /la riga 5 legge subito «B» di B\.js, che importa interni\/y\.js: in un giro il nome può non esserci ancora/],
    ])('%s', (_caso, corpo, nomi, messaggio) => {
        expect(() => moduli({ corpo, nomi })).toThrow(messaggio);
    });

    it('lo stesso giro con una funzione dichiarata, solo letta e non chiamata, passa: in un giro c\'è già', () => {
        expect(Object.keys(moduli({ corpo: ['  function A() { return y; }', '  var y = B.k;', '  function B() { return A; }'], nomi: ['A', 'B'] })).sort()).toStrictEqual(['A.js', 'B.js', 'componenti.js', 'interni/y.js']);
    });
});

describe('ogni nome è lo stesso oggetto da componenti.js e dal suo modulo, e uno stato del bundle c\'è una volta (voce 3511 · AC 2, AC 3)', () => {
    it('componenti.js esporta gli stessi nomi del bundle, quanti sono, e ognuno è quello del modulo del suo nome', () => {
        const nomi = nomiRegistrati();

        expect(Object.keys(componenti).sort()).toEqual([...nomi].sort());
        expect(nomi.filter((nome) => caricati[`${nome}.js`]?.[nome] !== come(componenti)[nome])).toEqual([]);
        expect(nomi.filter((nome) => come(componenti)[nome] === undefined)).toEqual([]);
    });

    it('il contatore degli id è uno: Field, Checkbox e di nuovo Field, da tre moduli, contano in fila', () => {
        const idDi = (markup: string, prefisso: string) => Number(new RegExp(`id="${prefisso}-(\\d+)`).exec(markup)?.[1]);
        const campo = caricati['Field.js']!['Field'] as typeof componenti.Field;
        const casella = caricati['Checkbox.js']!['Checkbox'] as typeof componenti.Checkbox;
        const primo = idDi(renderToStaticMarkup(React.createElement(campo, { label: 'Nome' })), 'fld');
        const secondo = idDi(renderToStaticMarkup(React.createElement(casella, { label: 'Sì', hint: 'Si può cambiare' })), 'chk');
        const terzo = idDi(renderToStaticMarkup(React.createElement(campo, { label: 'Cognome' })), 'fld');

        expect([secondo - primo, terzo - secondo]).toStrictEqual([1, 1]);
    });

    it('il contesto dei testi comuni è uno: LabelsProvider dal suo modulo arriva a useLabels dal suo', () => {
        const Fornitore = caricati['LabelsProvider.js']!['LabelsProvider'] as typeof componenti.LabelsProvider;
        const usaITesti = caricati['useLabels.js']!['useLabels'] as typeof componenti.useLabels;
        const Legge = () => React.createElement('span', null, usaITesti().close);

        expect(renderToStaticMarkup(React.createElement(Fornitore, { labels: { close: 'Serra' } }, React.createElement(Legge)))).toBe('<span>Serra</span>');
    });
});

describe('il modulo segna pure le tre righe dei dati di esempio e dei formattatori dei numeri, e nessun\'altra (sprint 50 · T1.3)', () => {
    it('dal corpo del bundle cambiano tre righe sole, quelle, e solo per il segno', () => {
        const delCorpo = new Set(righeDelBundle.slice(3, rigaDellaRegistrazione));
        const diverse = Object.values(testi).flatMap((testo) => corpoDi(testo)).filter((riga) => !delCorpo.has(riga));

        expect(diverse.sort()).toEqual([
            "  var EUR = /* @__PURE__ */ new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });",
            "  var NF = /* @__PURE__ */ new Intl.NumberFormat('it-IT');",
            '  var SAMPLE_CONTACTS = /* @__PURE__ */ [',
        ]);
    });

    it.each(SEGNATE)('senza la riga «%s…» nel bundle lo script si ferma e la nomina', (inizio) => {
        const finto = bundle.replace(`\n${inizio}`, `\n${inizio.replace('var ', 'let ')}`);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(new RegExp(`forma inattesa del bundle: .*«${inizio.trim().replace(/[$]/g, '\\$&')}`));
    });

    // Sprint 50 · T6 (review, R5): non basta l'inizio della riga. Se cambia ciò che sta dopo l'uguale — una chiamata al posto del
    // valore, una riga della tabella con una funzione, il `.map` che diventa un'altra cosa — lo script si ferma: non segna puro un
    // valore che non conosce.
    it.each([
        ['NF con una chiamata', "  var NF = new Intl.NumberFormat('it-IT');", "  var NF = creaFormatore('it-IT');", 'var NF ='],
        ['EUR con un\'altra valuta', "maximumFractionDigits: 0 });", "maximumFractionDigits: 2 });", 'var EUR ='],
        ['una riga della tabella con una chiamata', "    ['Paolo Greco', 'p.greco@nexa.it',", "    [registra('Paolo Greco'), 'p.greco@nexa.it',", 'var SAMPLE_CONTACTS ='],
        ['il .map che diventa un\'altra cosa', "  ].map(function (r, i) {", "  ].forEach(function (r, i) {", 'var SAMPLE_CONTACTS ='],
    ])('con %s dopo l\'uguale lo script si ferma e nomina la riga', (_come, da, a, nome) => {
        const finto = bundle.replace(da, a);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(new RegExp(`forma inattesa del bundle: la riga «${nome} …», da segnare pura, non è nella forma che lo script conosce`));
    });

    it.each(SEGNATE)('con la riga «%s…» due volte nel bundle lo script si ferma', (inizio) => {
        const riga = righeDelBundle.find((questa) => questa.startsWith(inizio)) ?? '';
        // Lo script lavora sul testo e non lo esegue: la riga ripetuta basta, anche se il bundle così non girerebbe.
        const finto = bundle.replace(`\n${riga}\n`, `\n${riga}\n${riga}\n`);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(/forma inattesa del bundle: .*2 volte/);
    });
});

// Sprint 50 · T6 (review, R10): i tre valori segnati puri sono quelli di prima dove servono. `CrmContacts` senza `contacts`
// mostra i contatti di esempio, e i numeri escono coi formattatori di sempre: da tutti e due gli ingressi.
describe('dove servono, i dati di esempio e i formattatori dei numeri ci sono (sprint 50 · T1.2)', () => {
    const inEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const inCifre = new Intl.NumberFormat('it-IT');

    it.each([
        ['il modulo dei componenti', componenti],
        ['Zeiras', Zeiras],
    ] as const)('da %s: CrmContacts senza contacts mostra i contatti di esempio, DealCard l\'importo in euro, PageHeader il numero', (_da, da) => {
        const contatti = renderToStaticMarkup(React.createElement(da.CrmContacts, {}));
        const trattativa = renderToStaticMarkup(React.createElement(da.DealCard, { title: 'Rinnovo', amount: 18500 }));
        const testata = renderToStaticMarkup(React.createElement(da.PageHeader, { title: 'Contatti', count: 12345 }));

        expect(['Anna Ferri', 'Paolo Greco'].map((nome) => contatti.includes(nome))).toStrictEqual([true, true]);
        expect(trattativa).toContain(inEuro.format(18500));
        expect(testata).toContain(inCifre.format(12345));
        expect(inCifre.format(12345)).toBe('12.345');
    });
});

describe('il modulo esporta ciò che il bundle registra in window.Zeiras, coi nomi di index.d.ts (T1.2)', () => {
    it('né un nome di meno né uno di più, e nessuno con un altro nome', () => {
        const esportati = Object.keys(componenti).sort();

        expect(esportati).toEqual([...nomiRegistrati()].sort());
        expect(esportati).toEqual([...nomiDichiarati()].sort());
        expect(esportati).toEqual(expect.arrayContaining(['Alert', 'AppShell', 'Avatar', 'AvatarStack', 'Button', 'ICON_NAMES']));
    });

    it('Avatar.Stack è AvatarStack', () => {
        expect(come(componenti.Avatar)['Stack']).toBe(componenti.AvatarStack);
    });
});

describe('davanti a un bundle di un\'altra forma lo script si ferma e dice che cosa non ha trovato (T1.3)', () => {
    it.each<[string, (testo: string) => string, RegExp]>([
        ['la prima riga non è il commento del formato', (testo) => testo.replace('/* @ds-bundle: ', '/* @bundle: '), /riga 1.*@ds-bundle/],
        ['un altro format', (testo) => testo.replace('{"format":4,', '{"format":5,'), /riga 1.*formato 5.*il 4/],
        ['un altro spazio dei nomi', (testo) => testo.replace('"namespace":"Zeiras"', '"namespace":"Altro"'), /riga 1.*«Altro».*«Zeiras»/],
        ['la seconda riga diversa', (testo) => testo.replace('\n(function () {\n', '\n(function (window) {\n'), /riga 2.*«\(function \(\) \{»/],
        ['la terza riga diversa', (testo) => testo.replace('\n  var React = window.React;\n', '\n  var React = globalThis.React;\n'), /riga 3.*«  var React = window\.React;»/],
        ['la registrazione che non si trova', (testo) => testo.replace(INIZIO_DELLA_REGISTRAZIONE, '  window.Zeiras = {'), /registrazione.*non c'è/],
        ['la registrazione due volte', (testo) => testo.replace(INIZIO_DELLA_REGISTRAZIONE, `${INIZIO_DELLA_REGISTRAZIONE}\n  });\n${INIZIO_DELLA_REGISTRAZIONE}`), /registrazione.*2 volte/],
        ['una coppia con due nomi diversi', (testo) => testo.replace('    Logo: Logo,', '    Logo: Marchio,'), /«Logo: Marchio».*«Nome: Nome»/],
        ['una coppia che non è fatta di due nomi', (testo) => testo.replace('    Logo: Logo,', '    Logo: crea(Logo),'), /«Logo: crea\(Logo\)».*«Nome: Nome»/],
        ['un nome registrato due volte', (testo) => testo.replace('    Logo: Logo,', '    Logo: Logo, Logo: Logo,'), /«Logo».*2 volte/],
        ['la coda diversa', (testo) => testo.replace(/\n\}\)\(\);\n$/, '\n}).call(window);\n'), /dopo la registrazione.*«\}\)\(\);»/],
        ['il corpo che legge ancora window.React', (testo) => testo.replace('  var h = React.createElement;', '  var h = window.React.createElement;'), /riga 4.*«window\.React»/],
    ])('%s', (_caso, cambia, messaggio) => {
        const finto = cambia(bundle);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(messaggio);
    });

    it('il bundle com\'è passa: i casi qui sopra cambiano una cosa sola', () => {
        expect(() => genera(bundle)).not.toThrow();
    });
});

describe('chi installa come oggi non si accorge di niente (T1.4)', () => {
    it('Zeiras e window.Zeiras hanno i nomi del modulo, e sono gli stessi oggetti: una copia sola del design system', () => {
        const nomi = Object.keys(componenti).sort();

        expect(window.Zeiras).toBe(Zeiras);
        expect(Object.keys(Zeiras).sort()).toEqual(nomi);
        for (const nome of nomi) {
            expect(come(Zeiras)[nome], nome).toBe(come(componenti)[nome]);
        }
        expect(Zeiras.AppShell).toBe(componenti.AppShell);
    });

    it('window.React è scritto, ed è il React dell\'app', () => {
        expect(window.React.createElement).toBe(React.createElement);
        expect(window.React.useState).toBe(React.useState);
    });
});
