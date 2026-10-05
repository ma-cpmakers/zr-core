// Genera resources/css/zeiras-token.css dai token del design system di Zeiras (resources/zeiras/tokens.json, copia derivata):
// ogni token diventa una variabile CSS col suo nome — `--surface`, `--space-4`, `--radius-md`, `--shadow-card`, `--z-dialog`, e
// `--font-display` e `--font-sans` per le famiglie —, che sono i nomi che usa bundle.css. Di colori e ombre vale il tema chiaro;
// un valore che rimanda a un altro token (`{pine}`) diventa `var(--pine)`. È un file statico, non uno stile iniettato da JS: con
// una CSP senza 'unsafe-inline' lo stile iniettato è bloccato. Si lancia con `npm run token` a ogni riallineamento.
import { readFileSync, writeFileSync } from 'node:fs';

const token = JSON.parse(readFileSync(new URL('../resources/zeiras/tokens.json', import.meta.url), 'utf8'));

const valore = (testo) => String(testo).replace(/^\{([a-z0-9-]+)\}$/, 'var(--$1)');

const variabili = [
    ...[token.color, token.shadow].flatMap((gruppo) => gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value.light)])),
    ...[token.spacing, token.radius, token.layout, token.zIndex].flatMap((gruppo) =>
        gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value)]),
    ),
    ...Object.entries(token.type.families).map(([famiglia, testo]) => [`--font-${famiglia}`, valore(testo)]),
];

const css = `/* Generato da scripts/token-css.mjs da resources/zeiras/tokens.json: non si modifica a mano, si rigenera con
   \`npm run token\` a ogni riallineamento al design system. Tema chiaro. Si carica dopo bundle.css. */
:root {
${variabili.map(([nome, testo]) => `    ${nome}: ${testo};`).join('\n')}
}
`;

writeFileSync(new URL('../resources/css/zeiras-token.css', import.meta.url), css);
