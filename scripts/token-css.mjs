// Genera resources/css/zeiras-token.css dai token del design system di Zeiras (resources/zeiras/tokens.json, copia derivata):
// ogni token diventa una variabile CSS col suo nome — `--surface`, `--space-4`, `--radius-md`, `--shadow-card`, `--z-dialog`, e
// `--font-display` e `--font-sans` per le famiglie —, che sono i nomi che usa bundle.css. Di colori e ombre vale il tema chiaro;
// un valore che rimanda a un altro token (`{pine}`) diventa `var(--pine)`. Dalla v3.13.0 (voce #2828) anche gli stili di testo,
// coi nomi del tema di Tailwind 4: `--text-heading-1`, `--text-heading-1--line-height`, `--text-heading-1--font-weight` e, dove
// c'è, `--text-heading-1--letter-spacing`. È un file statico, non uno stile iniettato da JS: con una CSP senza 'unsafe-inline'
// lo stile iniettato è bloccato. Si lancia con `npm run token` a ogni riallineamento; `npm run token -- --controlla` non scrive:
// rigenera in memoria, confronta col file ed esce con 1 se è diverso.
import { readFileSync, writeFileSync } from 'node:fs';

const token = JSON.parse(readFileSync(new URL('../resources/zeiras/tokens.json', import.meta.url), 'utf8'));

const valore = (testo) => String(testo).replace(/^\{([a-z0-9-]+)\}$/, 'var(--$1)');

const variabili = [
    ...[token.color, token.shadow].flatMap((gruppo) => gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value.light)])),
    ...[token.spacing, token.radius, token.layout, token.zIndex].flatMap((gruppo) =>
        gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value)]),
    ),
    ...Object.entries(token.type.families).map(([famiglia, testo]) => [`--font-${famiglia}`, valore(testo)]),
    ...token.type.groups.flatMap((gruppo) => gruppo.styles).flatMap(({ name, fontSize, lineHeight, fontWeight, letterSpacing }) => [
        [`--text-${name}`, fontSize],
        [`--text-${name}--line-height`, lineHeight],
        [`--text-${name}--font-weight`, fontWeight],
        ...(letterSpacing === undefined ? [] : [[`--text-${name}--letter-spacing`, letterSpacing]]),
    ]),
];

const css = `/* Generato da scripts/token-css.mjs da resources/zeiras/tokens.json: non si modifica a mano, si rigenera con
   \`npm run token\` a ogni riallineamento al design system. Tema chiaro. Si carica dopo bundle.css. */
:root {
${variabili.map(([nome, testo]) => `    ${nome}: ${testo};`).join('\n')}
}
`;

const file = new URL('../resources/css/zeiras-token.css', import.meta.url);
const percorso = 'resources/css/zeiras-token.css';

if (process.argv.includes('--controlla')) {
    let scritto = null;
    try {
        scritto = readFileSync(file, 'utf8');
    } catch {
        // Il file che manca non è quello che i token generano: lo dice il confronto qui sotto.
    }
    if (scritto !== css) {
        console.error(`${percorso} non è quello che resources/zeiras/tokens.json genera${scritto === null ? ' (il file non c\'è)' : ''}.\nEsce solo da \`npm run token\`: non si ritocca a mano, e si rigenera quando i token cambiano.`);
        process.exit(1);
    }
    console.log(`${percorso}: è quello che resources/zeiras/tokens.json genera (${variabili.length} variabili)`);
} else {
    writeFileSync(file, css);
    console.log(`scritto ${percorso} (${variabili.length} variabili)`);
}
