// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundleIntero, coiCssDelPacchetto, coiFontDelPacchetto, dividiIlCss, leggi, moduli, ORDINE_DEGLI_STRATI, STILI_A_PARTE } from '../../../scripts/componenti-genera.mjs';

// Sprint 75 · T1 (voce 2570). Dalla `v3.3.0` `npm run componenti` divide anche resources/zeiras/bundle.css (copia derivata del
// design system, che resta com'è): resources/css/zeiras.css è il bundle senza gli stili dei componenti di `STILI_A_PARTE`, e
// ognuno di loro ha i suoi in resources/css/zeiras/<Nome>.css, che il modulo che ne usa le classi importa. Così un'app che li prende dai loro moduli a
// richiesta non porta quegli stili nel CSS del primo carico. Il caso gira in node: legge i file del repo.

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const bundleCss = readFileSync(delRepo('resources/zeiras/bundle.css'), 'utf8');
const bundleJs = readFileSync(delRepo('resources/zeiras/bundle.js'), 'utf8');
// Dalla `v4.8.1` (#3055) l'Alert ha un modulo suo ma non un CSS suo: i suoi stili restano in zeiras.css, dove servono anche al Toast.
const NOMI = STILI_A_PARTE;
/**
 * Un CSS generato senza ciò che il generatore aggiunge intorno alle righe del bundle: la riga dell'ordine degli strati, il commento
 * che lo dice generato e, dalla `v5.0.0` (voce #3538), l'apertura e la chiusura di `@layer zeiras`.
 */
const corpo = (css: string) => css
    .replace(`${ORDINE_DEGLI_STRATI}\n`, '')
    .replace(/^\/\* Generato da scripts\/componenti\.mjs[\s\S]*?\*\/\n/, '')
    .replace(/^@layer zeiras \{\n/m, '')
    .replace(/\}\n$/, '');
const piene = (css: string) => css.split('\n').filter((riga) => riga.trim() !== '');
/** Le prime righe di bundle.css e zeiras.css, sotto il commento: i file del pacchetto scritti a mano (voci #3534, #3535 e #3887). */
const IMPORT_DEL_PACCHETTO = ["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';", "@import './rimedi.css' layer(zeiras);"] as const;

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

    it('in zeiras.css la prima regola è l\'`@import` dei font del pacchetto, dove il bundle ha quello di Google, sotto la riga dell\'ordine degli strati (sprint 92 · T2.1; voce 3538)', () => {
        const regole = dividiIlCss(bundleCss).zeiras.replace(/\/\*[\s\S]*?\*\//g, '').trimStart();

        expect(regole.startsWith(`${ORDINE_DEGLI_STRATI}\n\n@import './font.css';\n`)).toBe(true);
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
        // Dalla voce #3534 sotto la riga dei font c'è quella di movimento.css, dalla #3535 quella di avanzamento.css e dalla #3887 quella di rimedi.css
        // (assistenza.css no: arriva col pezzo degli avvisi): le altre sono le righe del bundle, nel loro ordine.
        expect(righe).toHaveLength(delBundle.length + 3);
        expect(righe.slice(0, 4)).toStrictEqual([...IMPORT_DEL_PACCHETTO]);
        expect(righe.slice(4)).toStrictEqual(delBundle.slice(1));
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
            // Dalla v5.0.0 (voce #3538) le regole del design system stanno in `@layer zeiras`: si leggono come il telefono le legge.
            else if (preludio.startsWith('@layer')) leggiBlocco(dentro);
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
            const prime = corpo(readFileSync(delRepo(percorso), 'utf8')).split('\n').slice(0, 4);

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
    const blocco = (selettore: string) => new RegExp(`(?:^|\\} )${selettore.replace(/[.*()]/g, '\\$&')} \\{([^}]*)\\}`).exec(regole)?.[1]?.trim() ?? '';

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

// Voce #3887 (Decisione 25420 di zr-pm-74, da zr-cashflow). I rimedi provvisori al CSS del design system, finché il design system
// non porta la richiesta che li toglie: stanno in resources/css/rimedi.css, scritto a mano, che bundle.css e zeiras.css importano
// sotto avanzamento.css. Il primo: il titolo della SectionCard con una parola senza spazi va a capo (richiesta 290).
describe('i rimedi provvisori al CSS del design system (voce 3887)', () => {
    const rimedi = readFileSync(delRepo('resources/css/rimedi.css'), 'utf8');
    const regole = rimedi.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();

    it('bundle.css e zeiras.css importano rimedi.css sotto avanzamento.css, una volta sola, e la regola non sta nella parte copiata dal bundle (AC 2)', () => {
        for (const css of [bundleIntero(bundleCss), dividiIlCss(bundleCss).zeiras]) {
            const righe = css.split('\n');
            expect(righe.filter((riga) => riga === "@import './rimedi.css' layer(zeiras);")).toHaveLength(1);
            expect(righe.indexOf("@import './rimedi.css' layer(zeiras);")).toBe(righe.indexOf("@import './avanzamento.css';") + 1);
            expect(css).not.toMatch(/\.zr-section-card-title \{[^}]*overflow-wrap/);
        }
    });

    it('rimedi.css porta i rimedi delle richieste aperte, uno per riga, e nient\'altro (voci 3887, 3888, 3889, 3890, 3891 e 3948-3951; v4.35.2, richiesta 293; v4.36.0, richiesta 294; v5.0.1, richiesta 299)', () => {
        expect(regole).toBe([
            '.zr-section-card-title { overflow-wrap: anywhere; }',
            '.zr-lanes .zr-card[draggable="true"] { touch-action: manipulation; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }',
            '.zr-card.zr-tocco-ombra { position: fixed; top: 0; left: 0; z-index: var(--z-toast); margin: 0; pointer-events: none; box-shadow: var(--shadow-lift); }',
            '.zr-detail-body, .zr-table-scroll, .zr-seg, .zr-main, .zr-main-body { scroll-padding: var(--space-1); }',
            '@media (forced-colors: active) { .zr-nav-item.is-active:not(:focus-visible), .zr-seg-item.is-active:not(:focus-visible) { outline: var(--border-ring) solid Highlight; outline-offset: calc(-1 * var(--border-ring)); } }',
            '@media (width > 720px) { .zr-search { box-shadow: inset 0 0 0 1px var(--line-strong); } }',
            '@media (forced-colors: active) and (width > 720px) { .zr-search { outline: 1px solid CanvasText; outline-offset: -1px; } }',
            '@media (forced-colors: active) { .zr-search.is-open { outline: 1px solid CanvasText; outline-offset: -1px; } }',
            '@media (max-width: 720px) { .zr-top:has(.zr-search.is-open) .zr-top-actions { min-width: 0; overflow: hidden; } }',
            '.zr-toast :is(.zr-toast-action, .zr-toast-close):focus-visible { outline-color: var(--surface); }',
            '.zr-lanes[data-zr-fuori] .zr-col.is-over { background: var(--surface-sunken); border-color: transparent; }',
            '.zr-lanes[data-zr-fuori] .zr-col.is-won.is-over { background: var(--success-soft); }',
            '@media (pointer: coarse) { .zr-td-check .zr-check::after { content: \'\'; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }',
            ':is(div, footer):is(.zr-page-actions, .zr-section-card-actions, .zr-section-card-foot, .zr-detail-foot, .zr-dialog-foot, .zr-variant-actions, .zr-appt-actions) { row-gap: var(--space-3); }',
            'button.zr-switch { min-height: 44px; } .zr-top .zr-search { height: 44px; } }',
            '@media (pointer: coarse) and (max-width: 720px) { .zr-top .zr-search.is-open { top: var(--space-2); } }',
        ].join(' '));
    });

    // Voci 3948-3951 (richieste 272, 273, 242 e 298; verifica del 17/11, Decisione 25922 di zr-pm-74, v5.5.0). La prova in Chromium col
    // tocco emulato (hit-test a griglia di 1 px sulla pagina di prova con DataTable, PageHeader, Switch e la ricerca aperta, a 320
    // e 390 px: casella 24×44 e la riga aperta a ±21 px, Filtra/Esporta 40, Switch 24, ricerca 40 senza; 44 con) è nella voce.
    // Quando il design system porta una delle quattro richieste, il suo caso diventa rosso e il rimedio si toglie.
    it('al tocco il design system di oggi lascia sotto i 44 px la casella di riga, le azioni a capo, lo Switch e la ricerca (voci 3948-3951)', () => {
        const alTocco = [...bundleCss.matchAll(/@media \(pointer: coarse\) \{([\s\S]*?)\}\s*\}/g)].map((m) => m[1]).join(' ');
        // 272: nessuna area propria per la casella della cella; 273: nessun row-gap al tocco; 242: nessuna regola dello Switch; 298:
        // il campo della ricerca non cambia altezza.
        expect(alTocco).not.toMatch(/zr-td-check/);
        expect(alTocco).not.toMatch(/zr-page-actions|row-gap: var\(--space-3\)/);
        expect(alTocco).not.toMatch(/zr-switch/);
        expect(alTocco).not.toMatch(/\.zr-search \{[^}]*height/);
        expect(bundleCss).toMatch(/\.zr-search \{[^}]*height: 40px/);
        expect(bundleCss).toMatch(/\.zr-page-actions \{[^}]*gap: var\(--space-2\)/);
    });

    it('i quattro rimedi al tocco valgono solo con pointer: coarse, e vincono sulle regole del bundle che vengono dopo (voci 3948-3951)', () => {
        // Fuori da `pointer: coarse` nessuna delle quattro: col mouse niente cambia (3950: «44 px anche col mouse» è il difetto).
        const fuori = regole.replace(/@media \(pointer: coarse\)[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
        expect(fuori).toContain('.zr-toast :is(');
        expect(fuori).not.toMatch(/zr-td-check|row-gap|zr-switch|height: 44px/);
        // rimedi.css sta prima del bundle nello strato: la casella e il row-gap hanno un selettore più forte del `gap` e del
        // `min-height` del bundle (tag + classe), la ricerca aperta più forte di `.zr-search.is-open` sotto i 720 px.
        expect(regole).toContain(':is(div, footer):is(.zr-page-actions');
        expect(regole).toContain('button.zr-switch { min-height: 44px; }');
        expect(regole).toContain('.zr-top .zr-search.is-open { top: var(--space-2); }');
    });

    it('il titolo della SectionCard va a capo anche dentro una parola: overflow-wrap anywhere (AC 1, richiesta 290)', () => {
        // Il bundle di oggi non lo fa da sé: quando la 290 arriva, questo caso diventa rosso e il rimedio si toglie.
        expect(bundleCss).toMatch(/\.zr-section-card-title \{(?![^}]*overflow-wrap)[^}]*\}/);
    });

    // v4.35.2 (richiesta 293, zr-pm-74 16/11): le carte della DealPipeline col dito (resources/js/tocco.ts). Sulla carta il dito
    // scorre e ingrandisce come sempre (`manipulation`, non `none`: lo zoom resta), la pressione lunga non seleziona il testo; la
    // copia che segue il dito sta sopra tutto coi token del design system.
    it('le carte della DealPipeline lasciano scorrere il dito, e la copia che lo segue usa i token (v4.35.2, richiesta 293)', () => {
        const token = readFileSync(delRepo('resources/css/zeiras-token.css'), 'utf8');

        expect(token).toContain('--z-toast:');
        expect(token).toContain('--shadow-lift:');
        expect(regole).not.toMatch(/touch-action: none/);
        // Il design system di oggi trascina le carte solo col drag HTML5: quando la 293 arriva, questo caso diventa rosso e il
        // rimedio si toglie, con resources/js/tocco.ts.
        expect(readFileSync(delRepo('resources/js/zeiras/DealPipeline.js'), 'utf8')).not.toMatch(/pointerdown|onPointerDown|touchstart/i);
    });

    // v4.36.0 (richiesta 294, voce 3913; zr-pm-74 16/11): lo stesso per le schede della KanbanBoard (K.6). La regola prende ogni
    // `.zr-card` che si trascina dentro una lavagna, quindi anche le schede della board, che non hanno la classe della DealPipeline.
    it('anche le schede della KanbanBoard lasciano scorrere il dito: la regola è su .zr-card (v4.36.0, richiesta 294 · K.6)', () => {
        expect(regole).toContain('.zr-lanes .zr-card[draggable="true"] { touch-action: manipulation;');
        expect(regole).not.toContain('.zr-deal[draggable');
        // Il design system di oggi trascina le schede della board solo col drag HTML5: quando la 294 arriva, questo caso diventa
        // rosso e il rimedio si toglie (le maniglie delle liste usano già il puntatore, e restano fuori: sono della board).
        expect(readFileSync(delRepo('resources/js/zeiras/KanbanCard.js'), 'utf8')).not.toMatch(/pointerdown|onPointerDown|touchstart/i);
    });

    // Voce #3888 (richiesta 278, zr-crm-14; zr-pm-74 15/11): il comando portato in vista dentro un contenitore che scorre si
    // ferma a 4 px dal bordo, lo spazio dell'anello del fuoco (2 px più 2). Solo scroll-padding, che fuori dallo scorrimento
    // non sposta niente; la prova in Chromium (0 px senza, 4 con, la forma della pagina uguale) è nella voce.
    it('i contenitori che scorrono lasciano 4 px all\'anello del fuoco: scroll-padding var(--space-1), un token (voce 3888 · AC 1 e 3, richiesta 278)', () => {
        expect(readFileSync(delRepo('resources/css/zeiras-token.css'), 'utf8')).toContain('--space-1:');
        // Il bundle di oggi non lo fa da sé: quando la 278 arriva, questo caso diventa rosso e il rimedio si toglie.
        expect(bundleCss).not.toMatch(/scroll-padding/);
        expect(bundleIntero(bundleCss)).not.toMatch(/scroll-padding/);
    });

    // Voce #3889 (richieste 288 e 279; zr-pm-74 15/11). Coi colori forzati la voce attiva del menu e il segmento scelto hanno un
    // contorno; il campo Cerca chiuso, sopra i 720 px, ha il contorno che il design system gli dà da aperto, e coi colori forzati
    // un contorno vero. La prova in Chromium (prima e dopo, coi colori forzati e senza, 1280 e 390 px) è nella voce.
    it('coi colori forzati la voce attiva e il segmento scelto non restano col solo grassetto (voce 3889 · AC 1 e 4, richiesta 288)', () => {
        // Il bundle di oggi segna coi colori forzati solo .zr-radio-card e .zr-color: quando la 288 arriva, questo caso diventa rosso.
        const forzati = [...bundleCss.matchAll(/@media \(forced-colors: active\) \{([^\n]*)\}/g)].map((m) => m[1]).join(' ');
        expect(forzati).toContain('.zr-radio-card');
        expect(forzati).not.toMatch(/zr-nav-item|zr-seg-item/);
    });

    it('il campo Cerca chiuso sopra i 720 px ha il contorno del campo aperto, line-strong a 4,04:1 sul bianco della barra (voce 3889 · AC 2 e 4, richiesta 279)', () => {
        expect(bundleCss).toContain('.zr-search.is-open { box-shadow: inset 0 0 0 1px var(--line-strong); }');
        expect(bundleCss).toMatch(/\.zr-top \{[^}]*background: var\(--surface-raised\)/);
        // Il bundle di oggi non dà al campo chiuso né bordo né ombra: quando la 279 arriva, questo caso diventa rosso.
        for (const [, regola] of bundleCss.matchAll(/(?:^|\n|\} ?|\s)\.zr-search \{([^}]*)\}/g)) expect(regola).not.toMatch(/(?:^|;)\s*(?:border(?:-(?:top|right|bottom|left|width|style|color))?|box-shadow|outline)\s*:/);
        // Il contrasto si calcola dai token del pacchetto, non da colori scritti qui: almeno 3:1 (WCAG 1.4.11).
        // Nel tema chiaro (il primo :root) e nello scuro (data-theme="dark", dalla #3757).
        const token = readFileSync(delRepo('resources/css/zeiras-token.css'), 'utf8');
        const temi = [token.slice(0, token.indexOf(':root[data-theme="dark"]')), token.slice(token.indexOf(':root[data-theme="dark"]'))];
        const luce = (esa: string) => [1, 3, 5].map((i) => parseInt(esa.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((somma, c, i) => somma + c * [0.2126, 0.7152, 0.0722][i]!, 0);
        for (const tema of temi) {
            const colore = (nome: string) => new RegExp(`--${nome}: (#[0-9a-f]{6});`).exec(tema)?.[1] ?? '';
            expect(colore('line-strong')).toMatch(/^#/);
            const [scuro, chiaro] = [luce(colore('line-strong')), luce(colore('surface-raised'))].sort((a, b) => a - b);
            expect((chiaro! + 0.05) / (scuro! + 0.05)).toBeGreaterThanOrEqual(3);
        }
    });

    // Voce #3890 (richiesta 283; zr-pm-74 15/11). Sotto i 720 px il campo della ricerca aperto copre la barra; le azioni restano
    // sotto e, a 320 px col testo al 200%, allargavano la pagina a 338 px. La prova in Chromium (338 senza, 320 con; R390.9 di
    // uat-cornice, il Tab dalla ricerca a campanella e profilo della #2805, ancora ✅) è nella voce.
    it('con la ricerca aperta sotto i 720 px le azioni della barra si stringono e non allargano la pagina, e restano nel DOM (voce 3890, richiesta 283)', () => {
        // Il bundle di oggi dà a .zr-top-actions solo display, allineamento, spazio e posizione: quando la 283 arriva, questo caso
        // diventa rosso e il rimedio si toglie.
        const regole = [...bundleCss.matchAll(/\.zr-top-actions \{([^}]*)\}/g)].map((m) => m[1]).join(' ');
        expect(regole).toContain('display: flex');
        expect(regole).not.toMatch(/min-width|overflow|flex-wrap/);
        // Non `display: none` né `visibility: hidden`: campanella e profilo restano nel giro del Tab dopo la ricerca (#2805).
        expect(readFileSync(delRepo('resources/css/rimedi.css'), 'utf8')).not.toMatch(/zr-top-actions \{[^}]*(?:display|visibility)/);
    });

    // Voce #3891 (richiesta 291; zr-pm-74 15/11, Decisione 25442). Il Toast ha lo sfondo var(--ink) e l'anello del fuoco del design
    // system su «Annulla» e sulla ✕ è var(--focus): sotto 3:1 in tutti e due i temi (WCAG 1.4.11). Il rimedio gli dà il colore del
    // testo del Toast, var(--surface). La prova in Chromium è la riga TT.5 di uat-cornice (--staff, dalla v5.0.1: R1 della revisione).
    it('l\'anello del fuoco su «Annulla» e sulla ✕ del Toast ha il colore del testo del Toast, almeno 3:1 sullo sfondo (voce 3891, richiesta 291)', () => {
        // Il bundle di oggi dà ai due pulsanti l'anello var(--focus) e al Toast lo sfondo var(--ink): quando la 291 arriva, questo
        // caso diventa rosso e il rimedio si toglie.
        expect(bundleCss).toMatch(/:where\([^)]*\.zr-toast-action, \.zr-toast-close[^)]*\):focus-visible \{ outline: \d+px solid var\(--focus\);/);
        expect(bundleCss).toMatch(/\.zr-toast \{[^}]*background: var\(--ink\);[^}]*color: var\(--surface\);/);
        expect(bundleCss).not.toMatch(/\.zr-toast[^{]*:focus-visible[^{]*\{[^}]*outline-color/);
        // R2 della revisione della 3891 (v5.0.1): la 291 può arrivare anche come `--focus` ridefinito dentro il Toast, o come
        // `outline:` intero su una regola del Toast col fuoco: anche così il caso diventa rosso.
        expect(bundleCss).not.toMatch(/\.zr-toast[^{,]*\{[^}]*--focus\s*:/);
        expect(bundleCss).not.toMatch(/(?:^|\n|\} ?)\.zr-toast[^{,]*:focus-visible[^{]*\{[^}]*outline\s*:/);
        const token = readFileSync(delRepo('resources/css/zeiras-token.css'), 'utf8');
        const temi = [token.slice(0, token.indexOf(':root[data-theme="dark"]')), token.slice(token.indexOf(':root[data-theme="dark"]'))];
        const luce = (esa: string) => [1, 3, 5].map((i) => parseInt(esa.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((somma, c, i) => somma + c * [0.2126, 0.7152, 0.0722][i]!, 0);
        const rapporto = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        for (const tema of temi) {
            const colore = (nome: string) => new RegExp(`--${nome}: (#[0-9a-f]{6});`).exec(tema)?.[1] ?? '';
            for (const nome of ['ink', 'focus', 'surface']) expect(colore(nome)).toMatch(/^#/);
            expect(rapporto(luce(colore('focus')), luce(colore('ink')))).toBeLessThan(3);
            expect(rapporto(luce(colore('surface')), luce(colore('ink')))).toBeGreaterThanOrEqual(3);
        }
    });
});

// Richiesta 299 (zr-crm-35, regola di zr-pm-74 del 18/11; v5.0.1). La DealPipeline azzera la colonna segnata solo al rilascio:
// fuori dalla lavagna resources/js/tocco.ts la segna con data-zr-fuori, e rimedi.css rimette alla colonna lo sfondo e il bordo
// di .zr-col (e della fase vinta). I casi del segno sono in tocco.test.tsx; in Chromium, TC.10 di uat-cornice (--tocco).
describe('fuori dalla lavagna nessuna colonna segnata (v5.0.1, richiesta 299)', () => {
    it('rimedi.css rimette alla colonna segnata, sulla lavagna con data-zr-fuori, i valori di .zr-col del bundle: i token, nessun valore a mano', () => {
        expect(bundleCss).toMatch(/\.zr-col \{[^}]*background: var\(--surface-sunken\);[^}]*border: 1px solid transparent;/);
        expect(bundleCss).toContain('.zr-col.is-over { background: var(--pine-soft); border-color: var(--pine); }');
        expect(bundleCss).toContain('.zr-col.is-won { background: var(--success-soft); }');
    });

    it('la DealPipeline di oggi non ascolta dragleave: quando la 299 arriva, questo caso diventa rosso e il rimedio si toglie', () => {
        expect(readFileSync(delRepo('resources/js/zeiras/DealPipeline.js'), 'utf8')).not.toMatch(/onDragLeave/);
    });
});

// Voce #3723 (sì di zr-pm-97, 13/11). La fascia di assistenza come nel design di admin (`sa-imp`): una barra citrus a tutta
// larghezza sopra l'AppShell. Gli stili stanno in resources/css/assistenza.css, scritto a mano, che importa il pezzo degli avvisi
// (resources/js/avvisi.ts) e non il CSS di ogni pagina (zr-pm-74, 14/11); ogni misura dai token, per nome.
describe('la fascia di assistenza dal CSS del pacchetto (voce 3723)', () => {
    const assistenza = readFileSync(delRepo('resources/css/assistenza.css'), 'utf8');
    const regole = assistenza.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    const blocco = (selettore: string) => new RegExp(`(?:^|\\} )${selettore.replace(/[.*()]/g, '\\$&')} \\{([^}]*)\\}`).exec(regole)?.[1]?.trim() ?? '';

    it('assistenza.css lo importa il pezzo degli avvisi, una volta sola, e non il CSS di ogni pagina: bundle.css e zeiras.css non lo nominano (AC 1, zr-pm-74 14/11)', () => {
        for (const css of [bundleIntero(bundleCss), dividiIlCss(bundleCss).zeiras, readFileSync(delRepo('resources/css/bundle.css'), 'utf8'), readFileSync(delRepo('resources/css/zeiras.css'), 'utf8')]) {
            expect(css).not.toContain('assistenza.css');
            expect(css).not.toContain('.zr-assist');
        }
        const avvisi = readFileSync(delRepo('resources/js/avvisi.ts'), 'utf8');

        expect(avvisi.match(/^import '\.\.\/css\/assistenza\.css';$/gm)).toHaveLength(1);
        for (const ingresso of ['resources/js/index.ts', 'resources/js/app.ts', 'resources/js/cornice.tsx', 'resources/js/layout.tsx']) {
            expect(readFileSync(delRepo(ingresso), 'utf8')).not.toMatch(/^import .*assistenza\.css/m);
        }
    });

    it('la barra: citrus, a tutta larghezza, che va a capo; sopra anche ai dialoghi; con l\'AppShell sotto che prende il resto dell\'altezza (AC 1)', () => {
        expect(blocco('.zr-assist')).toBe('display: flex; flex-direction: column; height: 100vh; height: 100dvh;');
        expect(blocco('.zr-assist-bar')).toContain('flex: none; display: flex; flex-wrap: wrap; align-items: center;');
        expect(blocco('.zr-assist-bar')).toContain('background: var(--citrus); color: var(--on-citrus);');
        expect(blocco('.zr-assist-bar')).toContain('position: relative; z-index: calc(var(--z-dialog) + 3);');
        expect(blocco('.zr-assist-bar')).toContain('padding-left: max(var(--space-4), env(safe-area-inset-left, 0px)); padding-right: max(var(--space-4), env(safe-area-inset-right, 0px));');
        expect(blocco('.zr-assist > :not(.zr-assist-bar)')).toBe('flex: 1; min-height: 0; position: relative; container-type: size;');
        expect(blocco('.zr-assist > :not(.zr-assist-bar) .zr-shell')).toBe('height: 100%; min-height: 0;');
    });

    it('il nome in grassetto, la riga piccola (l\'ultimo figlio del testo), il pulsante chiaro col bordo scuro (AC 2)', () => {
        expect(blocco('.zr-assist-bar strong')).toBe('font-weight: var(--text-heading-1--font-weight);');
        expect(blocco('.zr-assist-bar > span > :last-child')).toBe('font-size: var(--text-caption); line-height: var(--text-caption--line-height); font-weight: var(--text-caption--font-weight);');
        expect(blocco('.zr-assist-bar .zr-btn')).toBe('background: var(--surface-raised); color: var(--ink); border-color: var(--on-citrus);');
    });

    it('nessun colore e nessuna misura scritti: tutto dai token (AC 1)', () => {
        expect(regole).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
        expect(regole).not.toMatch(/z-index: *\d/);
        // Anche lo spessore del testo viene da un token (revisione della v4.34.0, R4).
        expect(regole).not.toMatch(/font-weight: *\d/);
        expect(regole.match(/\b\d+(?:\.\d+)?(?:px|rem|em|ms|s|deg)\b/g)).toStrictEqual(['0px', '0px', '320px', '1023px', '720px', '0px']);
    });

    it('il pannello di dettaglio e, sotto i 721 px, ricerca, notifiche e profilo cominciano sotto la barra in alto: contati dal corpo, con `100cqh`, senza spostare i `fixed` (voce 3723, UAT del 14/11)', () => {
        const delDesignSystem = bundleCss.replace(/\s+/g, ' ');

        // Ciò che le regole del pacchetto spostano: nel design system si contano dalla cima della finestra.
        expect(delDesignSystem).toContain('.zr-detail { position: fixed; z-index: calc(var(--z-dropdown) - 1); top: var(--topbar-height);');
        expect(delDesignSystem).toContain('.zr-search-panel { position: fixed; top: calc(var(--topbar-height) +');
        expect(delDesignSystem).toContain('.zr-pop, .zr-top-actions .zr-profile-menu { position: fixed; left: var(--space-2); right: var(--space-2); width: auto; top: calc(var(--topbar-height) +');
        expect(blocco('.zr-assist .zr-detail:not(.is-inline)')).toBe('position: absolute;');
        expect(regole).toContain('@media (max-width: 720px) { .zr-assist :is(.zr-search-panel, .zr-pop, .zr-top-actions .zr-profile-menu) { top: calc(100dvh - 100cqh + var(--topbar-height) + var(--space-1)); }');
        expect(regole).toContain('.zr-assist .zr-search-panel { max-height: calc(100cqh - var(--topbar-height) - var(--space-4)); }');
        expect(regole).toContain('.zr-assist :is(.zr-pop, .zr-top-actions .zr-profile-menu) { max-height: calc(100cqh - var(--topbar-height) - var(--space-4) - env(safe-area-inset-bottom, 0px)); }');
    });

    it('un dialogo sta sopra la barra a ogni larghezza: il velo del dialogo ha uno strato più alto di quello della barra, che sopra i 720 px il design system mette sotto (revisione della v4.34.0, R1)', () => {
        const delDesignSystem = bundleCss.replace(/\s+/g, ' ');
        const strato = (dichiarazioni: string) => Number(/z-index: calc\(var\(--z-dialog\) \+ (\d)\)/.exec(dichiarazioni)?.[1]);

        // Nel design system il velo ha `--z-dialog`, e solo sotto i 721 px uno strato in più.
        expect(delDesignSystem).toContain('.zr-scrim { position: fixed; inset: 0; z-index: var(--z-dialog);');
        // Con `!important`: il pezzo dei rimedi scrive sul velo di un dialogo aperto `--z-dialog` + 2 nello stile dell'elemento.
        expect(blocco('.zr-assist .zr-scrim:not(.is-inline)')).toBe('z-index: calc(var(--z-dialog) + 4) !important;');
        expect(readFileSync(delRepo('resources/js/rimedi.ts'), 'utf8')).toContain("dialogo.parentElement?.style.setProperty('z-index', 'calc(var(--z-dialog) + 2)');");
        expect(strato(blocco('.zr-assist .zr-scrim:not(.is-inline)'))).toBeGreaterThan(strato(blocco('.zr-assist-bar')));
        expect(regole).not.toMatch(/@media[^{]*\{ *\.zr-assist \.zr-scrim/);
    });

    it('sotto i 1024 px il cassetto e il suo velo si ancorano al corpo, sotto la barra: `absolute` solo in assistenza, allo stesso punto di rottura dell\'AppShell, senza `contain` che sposti menu e dialoghi (scostamento dal design di admin, decisione di zr-pm-97 del 13/11)', () => {
        const delDesignSystem = bundleCss.replace(/\s+/g, ' ');

        // L'AppShell mette cassetto e velo in `fixed` da `top: 0` a questo punto di rottura: è ciò che la regola del pacchetto sposta.
        expect(delDesignSystem).toContain('@media (max-width: 1023px) { .zr-shell { grid-template-columns: minmax(0, 1fr); min-height: 0; } .zr-side { position: fixed; top: 0;');
        expect(delDesignSystem).toContain('.zr-side-scrim { position: fixed; inset: 0;');
        expect(regole).toContain('@media (max-width: 1023px) { .zr-assist .zr-side, .zr-assist .zr-side-scrim { position: absolute; } }');
        // Il corpo è il riferimento della posizione, e non crea un contesto che sposti i `fixed` di menu e dialoghi.
        expect(blocco('.zr-assist > :not(.zr-assist-bar)')).toContain('position: relative;');
        expect(regole).not.toMatch(/\bcontain\s*:|\btransform\s*:|\bfilter\s*:|will-change/);
        // La barra resta sopra il cassetto: il suo strato è più alto di quello del cassetto (`--z-dialog` + 2).
        expect(blocco('.zr-assist-bar')).toContain('z-index: calc(var(--z-dialog) + 3);');
        expect(delDesignSystem).toContain('z-index: calc(var(--z-dialog) + 2); width: min(320px, 86vw);');
    });
});
