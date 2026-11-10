// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundleIntero, coiFontDelPacchetto, dividiIlCss, leggi, moduli, STILI_A_PARTE } from '../../../scripts/componenti-genera.mjs';

// Sprint 75 · T1 (voce 2570). Dalla `v3.3.0` `npm run componenti` divide anche resources/zeiras/bundle.css (copia derivata del
// design system, che resta com'è): resources/css/zeiras.css è il bundle senza gli stili dei componenti di `STILI_A_PARTE`, e
// ognuno di loro ha i suoi in resources/css/zeiras/<Nome>.css, che il modulo che ne usa le classi importa. Così un'app che li prende dai loro moduli a
// richiesta non porta quegli stili nel CSS del primo carico. Il caso gira in node: legge i file del repo.

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const bundleCss = readFileSync(delRepo('resources/zeiras/bundle.css'), 'utf8');
const bundleJs = readFileSync(delRepo('resources/zeiras/bundle.js'), 'utf8');
// Dalla `v4.8.1` (#3055) l'Alert ha un modulo suo ma non un CSS suo: i suoi stili restano in zeiras.css, dove servono anche al Toast.
const NOMI = STILI_A_PARTE;
/** Un CSS generato senza il commento che lo dice generato: le righe che vengono dal bundle. */
const corpo = (css: string) => css.replace(/^\/\* Generato da scripts\/componenti\.mjs[\s\S]*?\*\/\n/, '');
const piene = (css: string) => css.split('\n').filter((riga) => riga.trim() !== '');

describe('gli stili dei componenti a parte escono dal CSS del primo carico (sprint 75 · T1.1, T1.2)', () => {
    it('i tre CSS sui file sono quelli che il bundle genera, e il bundle è quello del design system', () => {
        const divisi = dividiIlCss(bundleCss);

        expect(NOMI).toStrictEqual(['MentionField', 'AddressField']);
        expect(divisi.zeiras).toContain('.zr-alert {');
        expect(readFileSync(delRepo('resources/css/zeiras.css'), 'utf8')).toBe(divisi.zeiras);
        for (const nome of NOMI) {
            expect(readFileSync(delRepo(`resources/css/zeiras/${nome}.css`), 'utf8')).toBe(divisi.stili[nome]);
        }
    });

    it('ogni riga del bundle sta in uno solo dei tre CSS: in zeiras.css nessuna regola dei due componenti, nei loro CSS nessuna d\'altri', () => {
        const divisi = dividiIlCss(bundleCss);
        const delCss = corpo(divisi.zeiras);

        expect([...piene(delCss), ...NOMI.flatMap((nome) => piene(corpo(divisi.stili[nome])))].sort()).toStrictEqual(piene(coiFontDelPacchetto(bundleCss)).sort());
        expect(delCss).not.toMatch(/\.zr-(mention|address)/);
        expect(piene(corpo(divisi.stili.MentionField!)).every((riga) => /^\/\* MentionField[: ]|zr-mention/.test(riga))).toBe(true);
        expect(piene(corpo(divisi.stili.AddressField!)).every((riga) => /^\/\* AddressField[: ]|zr-address/.test(riga))).toBe(true);
        expect(divisi.proprie).toStrictEqual({
            MentionField: expect.arrayContaining(['zr-mention', 'zr-mention-x', 'zr-mention-list', 'zr-mention-opt']),
            AddressField: expect.arrayContaining(['zr-address-box', 'zr-address-list', 'zr-address-ok']),
        });
        expect(divisi.proprie.AddressField).not.toContain('zr-mention-x');
        expect(divisi.proprie.MentionField).not.toContain('zr-avatar');
    });

    it('in zeiras.css la prima regola è l\'`@import` dei font del pacchetto, dove il bundle ha quello di Google (sprint 92 · T2.1)', () => {
        const regole = dividiIlCss(bundleCss).zeiras.replace(/\/\*[\s\S]*?\*\//g, '').trimStart();

        expect(regole.startsWith("@import './font.css';\n")).toBe(true);
        expect(bundleCss.trimStart().startsWith("@import url('https://fonts.googleapis.com/")).toBe(true);
    });

    it('un blocco che il bundle non ha, o che ha due volte, ferma lo script e dice di chi è', () => {
        expect(() => dividiIlCss(bundleCss.replace('/* AddressField */', '/* Indirizzo */'))).toThrow('il commento «/* AddressField …», che segna gli stili di AddressField in bundle.css, c\'è 0 volte');
        expect(() => dividiIlCss(`${bundleCss}/* MentionField: di nuovo */\n.zr-mention { color: var(--ink); }\n`)).toThrow('il commento «/* MentionField …», che segna gli stili di MentionField in bundle.css, c\'è 2 volte');
        expect(() => dividiIlCss(bundleCss.replace('/* AddressField */', '/* AddressField */\n.zr-mention-x { color: var(--ink); }').replace(/^\.zr-address.*\n/gm, '').replace(/^\.zr-field-msg\.zr-address-ok.*\n/m, ''))).toThrow('gli stili di AddressField in bundle.css non hanno una classe loro');
        expect(() => dividiIlCss(bundleCss.replace(/^(\/\* AddressField \*\/\n)[^]*?(?=^\/\* |(?![^]))/m, '$1'))).toThrow('gli stili di AddressField in bundle.css non hanno una classe loro');
        // Revisione della PR #134, rilievo 2: un commento in mezzo agli stili di un componente non lascia il resto in zeiras.css.
        expect(() => dividiIlCss(bundleCss.replace(/^(\.zr-address-list )/m, '/* le voci della lista */\n$1'))).toThrow(/righe con le classi \.zr-(?:mention|address) stanno fuori dagli stili di (?:MentionField|AddressField), dopo un commento/);
    });

    it('un modulo importa il CSS di ogni componente di cui usa le classi: AddressField anche quello di MentionField', () => {
        const letto = leggi(bundleJs);
        const divisi = dividiIlCss(bundleCss);
        const importati = (nome: string) => (moduli(letto, divisi)[`${nome}.js`] ?? '').split('\n').filter((riga) => riga.endsWith(".css';"));

        expect(importati('MentionField')).toStrictEqual(["import '../../css/zeiras/MentionField.css';"]);
        expect(importati('AddressField')).toStrictEqual(["import '../../css/zeiras/MentionField.css';", "import '../../css/zeiras/AddressField.css';"]);
        expect(importati('Alert')).toStrictEqual([]);
        // Dalla `v4.30.0` (voce #3511) ogni modulo: solo quei due importano un CSS.
        const conIlCss = Object.entries(moduli(letto, divisi)).filter(([, testo]) => /^import '.*\.css';$/m.test(testo)).map(([nome]) => nome);
        expect(conIlCss.sort()).toStrictEqual(['AddressField.js', 'MentionField.js']);
        // Senza le classi di MentionField nel suo codice, AddressField non importa i suoi stili.
        const senzaMention = moduli(leggi(bundleJs.replaceAll('zr-mention-', 'zr-nessuno-')), divisi)['AddressField.js'];
        expect(senzaMention).not.toContain('MentionField.css');
        // Il bundle si legge due volte: col lotto 0526 (bundle.js da 301 KB) sulla CI ci vogliono più dei 5 secondi di partenza.
    }, 30_000);
});

describe('i font del pacchetto al posto di Google Fonts nel CSS generato (sprint 92 · T2, voce 2945)', () => {
    const generati = ['resources/css/zeiras.css', 'resources/css/bundle.css', ...NOMI.map((nome) => `resources/css/zeiras/${nome}.css`)];

    it('nessun CSS di resources/css nomina fonts.googleapis.com o fonts.gstatic.com (T2.1)', () => {
        for (const percorso of [...generati, 'resources/css/font.css', 'resources/css/zeiras-token.css']) {
            expect(readFileSync(delRepo(percorso), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
        }
    });

    it('resources/css/bundle.css è quello che il bundle genera: il commento che lo dice generato, poi il bundle con la sola riga dei font cambiata (T2.2)', () => {
        const intero = readFileSync(delRepo('resources/css/bundle.css'), 'utf8');
        const righe = corpo(intero).split('\n');
        const delBundle = bundleCss.split('\n');

        expect(intero).toBe(bundleIntero(bundleCss));
        expect(righe).toHaveLength(delBundle.length);
        expect(righe.filter((riga, indice) => riga !== delBundle[indice])).toStrictEqual(["@import './font.css';"]);
        expect(righe[0]).toBe("@import './font.css';");
    });

    it('un bundle che chiede a Google altri font, o in un\'altra forma, ferma lo script; uno senza `@import` di Google prende i font del pacchetto in testa (T2.3)', () => {
        const altro = bundleCss.replace('Instrument+Sans:wght@400..700', 'Instrument+Sans:wght@400..800');
        const dueVolte = `${bundleCss}\n@import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');\n`;
        const daGstatic = bundleCss.replace(/^.*\n/, "@font-face { font-family: 'X'; src: url(https://fonts.gstatic.com/s/x.woff2); }\n");
        const conCrlf = bundleCss.replace(/\n/g, '\r\n');
        const colCommento = `/* il design system */\n${bundleCss}`;

        for (const css of [altro, dueVolte, daGstatic, conCrlf, colCommento]) {
            expect(() => coiFontDelPacchetto(css)).toThrow('bundle.css nomina Google Fonts in una forma che il pacchetto non sostituisce');
            expect(() => dividiIlCss(css)).toThrow('bundle.css nomina Google Fonts in una forma che il pacchetto non sostituisce');
            expect(() => bundleIntero(css)).toThrow('bundle.css nomina Google Fonts in una forma che il pacchetto non sostituisce');
        }
        const senza = bundleCss.replace(/^.*\n/, '');
        expect(coiFontDelPacchetto(senza)).toBe(`@import './font.css';\n${senza}`);
    });
});
