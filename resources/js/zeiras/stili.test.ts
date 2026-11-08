// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundleIntero, coiCssDelPacchetto, coiFontDelPacchetto, dividiIlCss, leggi, moduli, STILI_A_PARTE } from '../../../scripts/componenti-genera.mjs';

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
/** Le prime righe di bundle.css e zeiras.css, sotto il commento: i file del pacchetto scritti a mano (voci #3534 e #3535). */
const IMPORT_DEL_PACCHETTO = ["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';"] as const;

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

        expect([...piene(delCss), ...NOMI.flatMap((nome) => piene(corpo(divisi.stili[nome])))].sort()).toStrictEqual(piene(coiCssDelPacchetto(bundleCss)).sort());
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
        // Dalla voce #3534 sotto la riga dei font c'è quella di movimento.css, e dalla #3535 quella di avanzamento.css: le altre sono
        // le righe del bundle, nel loro ordine.
        expect(righe).toHaveLength(delBundle.length + 2);
        expect(righe.slice(0, 3)).toStrictEqual([...IMPORT_DEL_PACCHETTO]);
        expect(righe.slice(3)).toStrictEqual(delBundle.slice(1));
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

// v4.31.0 (zr-pm-07, 10/11). Al tocco ogni Button del design system si prende su 44 px senza cambiare aspetto: il pulsante
// piccolo è alto 32 px, e con `pointer: coarse` il suo `::after` gli dà 44 px intorno (6 sopra e 6 sotto per «Deselect» della
// barra della selezione del DataTable, misurato in Chromium a 390 px col tocco emulato). Il caso legge zeiras.css come lo
// leggerebbe un telefono largo 390 px: le regole fuori da ogni `@media` e quelle dei `@media` che a quel telefono valgono,
// nell'ordine del file; l'ultima dichiarazione vince. Diventa rosso se un riallineamento toglie l'area o la stringe.
const LARGHEZZA_DEL_TELEFONO = 390;
const vale = (condizione: string) => condizione.split(',').some((alternativa) => alternativa.trim().split(/\s+and\s+/).every((parte) => {
    const misura = parte.match(/^\((max|min)-width:\s*(\d+)px\)$/);
    if (misura) return misura[1] === 'max' ? Number(misura[2]) >= LARGHEZZA_DEL_TELEFONO : Number(misura[2]) <= LARGHEZZA_DEL_TELEFONO;
    return /^\(pointer:\s*coarse\)$/.test(parte) || /^\(any-pointer:\s*coarse\)$/.test(parte);
}));
/** Le dichiarazioni che un telefono largo 390 px dà a un selettore (`:where()` tolto), nell'ordine del CSS. */
function alTocco(css: string, selettore: string): Record<string, string> {
    const dichiarazioni: Record<string, string> = {};
    const leggiBlocco = (testo: string) => {
        let i = 0;
        while (i < testo.length) {
            const graffa = testo.indexOf('{', i);
            const puntoEVirgola = testo.indexOf(';', i);
            if (graffa < 0) break;
            if (puntoEVirgola >= 0 && puntoEVirgola < graffa) { i = puntoEVirgola + 1; continue; }
            const preludio = testo.slice(i, graffa).trim();
            let profondita = 1, fine = graffa + 1;
            while (profondita > 0 && fine < testo.length) { if (testo[fine] === '{') profondita++; else if (testo[fine] === '}') profondita--; fine++; }
            const dentro = testo.slice(graffa + 1, fine - 1);
            if (preludio.startsWith('@media')) { if (vale(preludio.slice(6).trim())) leggiBlocco(dentro); }
            else if (!preludio.startsWith('@')) {
                const selettori = preludio.split(',').map((s) => s.replace(/:where\(([^)]*)\)/g, '$1').trim());
                if (selettori.includes(selettore)) {
                    for (const riga of dentro.split(';')) {
                        const due = riga.indexOf(':');
                        if (due > 0) dichiarazioni[riga.slice(0, due).trim()] = riga.slice(due + 1).trim();
                    }
                }
            }
            i = fine;
        }
    };
    leggiBlocco(css.replace(/\/\*[\s\S]*?\*\//g, ''));
    return dichiarazioni;
}
/** Quanti px misura al più poco un lato dell'area: `max(100%, 44px)` o `44px`; ogni altra forma è 0. */
const almeno = (valore: string | undefined) => Number(valore?.match(/^(?:max\(100%,\s*(\d+)px\)|(\d+)px)$/)?.slice(1).find(Boolean) ?? 0);
/** I lati dell'area al tocco del Button: 0 se manca l'area. */
function areaDelButton(css: string) {
    const dopo = alTocco(css, '.zr-btn::after');
    const button = alTocco(css, '.zr-btn');
    const ce = dopo.content !== undefined && dopo.content !== 'none' && dopo.position === 'absolute' && dopo.display !== 'none'
        && ['relative', 'absolute', 'fixed', 'sticky'].includes(button.position ?? '');
    return ce ? { alta: almeno(dopo.height), larga: almeno(dopo.width) } : { alta: 0, larga: 0 };
}

describe('al tocco il Button si prende su 44 px (v4.31.0, zr-pm-07 10/11)', () => {
    const zeirasCss = readFileSync(delRepo('resources/css/zeiras.css'), 'utf8');

    it('a 390 px con `pointer: coarse` l\'area del Button è alta e larga almeno 44 px, anche quella del pulsante piccolo da 32', () => {
        expect(areaDelButton(zeirasCss)).toStrictEqual({ alta: 44, larga: 44 });
        expect(almeno(alTocco(zeirasCss, '.zr-btn-sm')['min-height'])).toBeLessThan(44);
    });

    it('senza l\'area, o con un\'area più stretta, o spenta da una regola dopo, il caso è rosso', () => {
        const riga = zeirasCss.split('\n').find((r) => r.includes('.zr-btn::after'))!;
        const senza = zeirasCss.replace(riga, '');
        const stretta = zeirasCss.replace(riga, riga.replace('height: max(100%, 44px)', 'height: max(100%, 43px)'));
        const spenta = `${zeirasCss}\n.zr-btn::after { content: none; }\n`;
        const soloSulMouse = zeirasCss.replace(riga, riga.replace('(pointer: coarse)', '(pointer: fine)'));
        const soloLarga = zeirasCss.replace(riga, riga.replace('(pointer: coarse)', '(pointer: coarse) and (min-width: 1024px)'));
        const senzaPosizione = zeirasCss.replace(riga, riga.replace(':where(.zr-btn) { position: relative; }', ''));

        for (const css of [senza, stretta, spenta, soloSulMouse, soloLarga, senzaPosizione]) {
            expect(css).not.toBe(zeirasCss);
            expect(Math.min(areaDelButton(css).alta, areaDelButton(css).larga)).toBeLessThan(44);
        }
    });
});

// Voce #3534 (Decisione 23090 di zr-pm-07). Chi chiede al sistema meno movimento non ha transizioni in nessuna pagina che carica il
// CSS del pacchetto: la regola sta in resources/css/movimento.css, scritto a mano, e bundle.css e zeiras.css la importano subito
// dopo i font. Non è nella parte copiata dal bundle, che la CI confronta riga per riga col design system.
describe('meno movimento dal CSS del pacchetto (voce 3534)', () => {
    const movimento = readFileSync(delRepo('resources/css/movimento.css'), 'utf8');
    const regole = movimento.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();

    it('bundle.css e zeiras.css importano movimento.css subito dopo i font, prima di ogni regola del bundle (T4)', () => {
        for (const percorso of ['resources/css/bundle.css', 'resources/css/zeiras.css']) {
            const prime = corpo(readFileSync(delRepo(percorso), 'utf8')).split('\n').slice(0, 3);

            expect(prime).toStrictEqual([...IMPORT_DEL_PACCHETTO]);
        }
        expect(bundleIntero(bundleCss).split('\n').filter((riga) => riga === "@import './movimento.css';")).toHaveLength(1);
        expect(dividiIlCss(bundleCss).zeiras.split('\n').filter((riga) => riga === "@import './movimento.css';")).toHaveLength(1);
        // La regola non sta nella parte copiata dal bundle: senza la riga dell'import, bundle.css è il bundle coi soli font cambiati.
        expect(bundleIntero(bundleCss)).not.toContain('prefers-reduced-motion: reduce) { *');
        // Un bundle senza Google prende in testa i font e, sotto, movimento.css.
        const senza = bundleCss.replace(/^.*\n/, '');
        expect(coiCssDelPacchetto(senza)).toBe(`${IMPORT_DEL_PACCHETTO.join('\n')}\n${senza}`);
    });

    it('con prefers-reduced-motion: reduce nessuna transizione, su ogni elemento e sui suoi ::before e ::after (T1)', () => {
        expect(regole).toBe('@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }');
    });

    it('senza la preferenza niente cambia, e le animazioni restano del design system: lo spinner del Button gira a 2,4 s (T2, T3)', () => {
        expect(regole.replace(/@media \(prefers-reduced-motion: reduce\) \{[^{}]*\{[^{}]*\} \}/, '').trim()).toBe('');
        expect(regole).not.toMatch(/animation/);
        expect(bundleCss).toContain('@media (prefers-reduced-motion: reduce) { .zr-btn-spin { animation-duration: 2.4s; } }');
    });
});

// Voce #3535 (Decisione 23090 di zr-pm-07). La barra d'avanzamento di Inertia senza il `<style>` che Inertia aggiunge da sé e la
// CSP di tutti ferma: un modulo chiede `progress: { includeCSS: false }` e gli stili arrivano da resources/css/avanzamento.css,
// scritto a mano, che bundle.css e zeiras.css importano sotto movimento.css. Colore e z-index dai token, per nome.
describe('la barra d\'avanzamento di Inertia dal CSS del pacchetto (voce 3535)', () => {
    const avanzamento = readFileSync(delRepo('resources/css/avanzamento.css'), 'utf8');
    const regole = avanzamento.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    const blocco = (selettore: string) => new RegExp(`(?:^|\\} )${selettore.replace(/[.*]/g, '\\$&')} \\{([^}]*)\\}`).exec(regole)?.[1]?.trim() ?? '';

    it('bundle.css e zeiras.css importano avanzamento.css sotto movimento.css, una volta sola (AC 5)', () => {
        for (const css of [bundleIntero(bundleCss), dividiIlCss(bundleCss).zeiras]) {
            expect(css.split('\n').filter((riga) => riga === "@import './avanzamento.css';")).toHaveLength(1);
        }
        expect(bundleIntero(bundleCss)).not.toContain('#nprogress');
    });

    it('la barra: in alto, a tutta larghezza, alta 2 px, nel colore --pine, a --z-toast; il contenitore non prende i clic (AC 1, 4)', () => {
        expect(blocco('#nprogress .bar')).toBe('position: fixed; z-index: var(--z-toast); top: 0; left: 0; width: 100%; height: 2px; background: var(--pine);');
        expect(blocco('#nprogress')).toContain('pointer-events: none;');
        // Il popover del browser ha `inset: 0`: si toglie prima di mettere il contenitore in alto, non dopo.
        expect(blocco('#nprogress').indexOf('inset: unset;')).toBeLessThan(blocco('#nprogress').indexOf('top: 0;'));
        expect(blocco('#nprogress::backdrop')).toBe('display: none;');
    });

    it('nessun colore e nessuno z-index scritti: l\'unico numero è lo spessore della barra (AC 3)', () => {
        expect(regole).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
        expect(regole).not.toMatch(/z-index: *\d/);
        expect(regole.match(/\b\d+(?:\.\d+)?(?:px|rem|em|ms|s|deg)\b/g)).toStrictEqual(['2px']);
    });
});
