import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { genera } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import dichiarazioni from '../../zeiras/index.d.ts?raw';
import * as componenti from './componenti';
import generato from './componenti.js?raw';
import { Zeiras } from './index';

// Sprint 25 · T1 (voce #1759). I componenti del design system come modulo ES: `componenti.js` esce da scripts/componenti.mjs, che
// prende il corpo di resources/zeiras/bundle.js riga per riga e ne esporta per nome ciò che il bundle registra in `window.Zeiras`.
// La cornice e `Zeiras` li prendono da lì: una copia sola del design system per app. Il bundle, le dichiarazioni e il file generato
// si leggono qui come testo (`?raw`), senza `node:fs`. Ciò che il file deve contenere è scritto qui senza passare
// dallo script: rigenerarlo con lo stesso script non vedrebbe uno script cambiato.

const INIZIO_DELLA_REGISTRAZIONE = '  window.Zeiras = Object.assign(window.Zeiras || {}, {';
const righeDelBundle = bundle.split('\n');
const rigaDellaRegistrazione = righeDelBundle.indexOf(INIZIO_DELLA_REGISTRAZIONE);

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

describe('il file generato è quello che il bundle genera (T1.1)', () => {
    it('rigenerato in memoria dal bundle è uguale al file, carattere per carattere', () => {
        expect(genera(bundle)).toBe(generato);
    });

    it('con un carattere cambiato nel bundle non è più uguale: un bundle riallineato senza rigenerare non passa', () => {
        const cambiato = bundle.replace("'aria-label': 'Chiudi'", "'aria-label': 'Chiuda'");

        expect(cambiato).not.toBe(bundle);
        expect(genera(cambiato)).not.toBe(generato);
    });

    it('comincia col commento che dice da dove esce e con l\'import di React; il corpo è quello del bundle riga per riga; in fondo gli export', () => {
        const nomi = nomiRegistrati();
        const righe = generato.split('\n');

        expect(rigaDellaRegistrazione).toBeGreaterThan(3);
        expect(righe.slice(0, 3)).toEqual([
            '// Generato da scripts/componenti.mjs: non si ritocca a mano. Sono i componenti di resources/zeiras/bundle.js (il design system',
            '// di Zeiras, copia derivata) come modulo ES, esportati per nome; a un riallineamento si rigenera con `npm run componenti`.',
            "import * as React from 'react';",
        ]);
        // Dalla quarta riga del bundle (le prime tre sono il commento del formato, l'apertura e `var React = window.React;`) fino
        // alla riga prima della registrazione.
        expect(righe.slice(3, righe.length - nomi.length - 3)).toEqual(righeDelBundle.slice(3, rigaDellaRegistrazione).map(nelModulo));
        expect(righe.slice(righe.length - nomi.length - 3)).toEqual(['export {', ...nomi.map((nome) => `  ${nome},`), '};', '']);
        expect(generato).not.toContain('window.React');
        expect(generato).not.toContain('window.Zeiras');
    });
});

describe('il modulo segna pure le tre righe dei dati di esempio e dei formattatori dei numeri, e nessun\'altra (sprint 50 · T1.3)', () => {
    it('dal corpo del bundle cambiano tre righe sole, quelle, e solo per il segno', () => {
        const righe = generato.split('\n');
        const corpo = righeDelBundle.slice(3, rigaDellaRegistrazione);
        const diverse = corpo.flatMap((riga, indice) => (righe[indice + 3] === riga ? [] : [righe[indice + 3]]));

        expect(diverse).toEqual([
            "  var NF = /* @__PURE__ */ new Intl.NumberFormat('it-IT');",
            "  var EUR = /* @__PURE__ */ new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });",
            '  var SAMPLE_CONTACTS = /* @__PURE__ */ [',
        ]);
    });

    it.each(SEGNATE)('senza la riga «%s…» nel bundle lo script si ferma e la nomina', (inizio) => {
        const finto = bundle.replace(`\n${inizio}`, `\n${inizio.replace('var ', 'let ')}`);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(new RegExp(`forma inattesa del bundle: .*«${inizio.trim().replace(/[$]/g, '\\$&')}`));
    });

    it.each(SEGNATE)('con la riga «%s…» due volte nel bundle lo script si ferma', (inizio) => {
        const riga = righeDelBundle.find((questa) => questa.startsWith(inizio)) ?? '';
        // Lo script lavora sul testo e non lo esegue: la riga ripetuta basta, anche se il bundle così non girerebbe.
        const finto = bundle.replace(`\n${riga}\n`, `\n${riga}\n${riga}\n`);

        expect(finto).not.toBe(bundle);
        expect(() => genera(finto)).toThrow(/forma inattesa del bundle: .*2 volte/);
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
