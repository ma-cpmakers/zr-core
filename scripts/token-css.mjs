// Genera resources/css/zeiras-token.css dai token del design system di Zeiras (resources/zeiras/tokens.json, copia derivata):
// ogni token diventa una variabile CSS col suo nome — `--surface`, `--space-4`, `--radius-md`, `--shadow-card`, `--z-dialog`, e
// `--font-display` e `--font-sans` per le famiglie —, che sono i nomi che usa bundle.css. Di colori e ombre il `:root` ha il tema
// chiaro; un valore che rimanda a un altro token (`{pine}`) diventa `var(--pine)`. Dalla v4.36.0 (voce #3757, Decisione di zr-pm-cc
// del 13/11) anche il tema scuro di tokens.json: i colori e le ombre il cui valore scuro è diverso dal chiaro, una volta con
// `:root[data-theme="dark"]` (la persona ha scelto «Scuro») e una dentro `@media (prefers-color-scheme: dark)` con
// `:root[data-theme="system"]` («Come il sistema», e il sistema è scuro). Senza `data-theme`, o con `"light"`, resta il chiaro anche col
// sistema scuro: un modulo passa allo scuro quando scrive la scelta della persona (correzione di zr-pm-cc del 13/11, prima dell'uscita). Dalla v3.13.0 (voce #2828) anche gli stili di testo,
// coi nomi del tema di Tailwind 4: `--text-heading-1`, `--text-heading-1--line-height`, `--text-heading-1--font-weight` e, dove
// c'è, `--text-heading-1--letter-spacing`; dalla v4.2.0 anche gli spessori di bordo (`--border-strong`, richiesta 139). È un
// file statico, non uno stile iniettato da JS: con una CSP senza 'unsafe-inline' lo stile iniettato è bloccato. Dalla v5.0.0
// (voce #3536) scrive anche resources/css/zeiras-tailwind.css, il tema di Tailwind 4 coi nomi dei token; le funzioni che danno
// i due testi stanno in scripts/token-genera.mjs. Si lancia con `npm run token` a ogni riallineamento; `npm run token --
// --controlla` non scrive: rigenera in memoria, confronta coi file ed esce con 1 se uno è diverso.
import { readFileSync, writeFileSync } from 'node:fs';
import { cssDeiToken, cssPerTailwind, scureDeiToken, temaDeiToken, variabiliDeiToken } from './token-genera.mjs';

const token = JSON.parse(readFileSync(new URL('../resources/zeiras/tokens.json', import.meta.url), 'utf8'));

const file = [
    ['resources/css/zeiras-token.css', cssDeiToken(token), `${variabiliDeiToken(token).length} variabili, ${scureDeiToken(token).length} nel tema scuro`],
    ['resources/css/zeiras-tailwind.css', cssPerTailwind(token), `${temaDeiToken(token).length} variabili del tema`],
];

if (process.argv.includes('--controlla')) {
    let diversi = 0;
    for (const [percorso, css, quante] of file) {
        let scritto = null;
        try {
            scritto = readFileSync(new URL(`../${percorso}`, import.meta.url), 'utf8');
        } catch {
            // Il file che manca non è quello che i token generano: lo dice il confronto qui sotto.
        }
        if (scritto !== css) {
            console.error(`${percorso} non è quello che resources/zeiras/tokens.json genera${scritto === null ? ' (il file non c\'è)' : ''}.\nEsce solo da \`npm run token\`: non si ritocca a mano, e si rigenera quando i token cambiano.`);
            diversi += 1;
        } else {
            console.log(`${percorso}: è quello che resources/zeiras/tokens.json genera (${quante})`);
        }
    }
    process.exit(diversi === 0 ? 0 : 1);
} else {
    for (const [percorso, css, quante] of file) {
        writeFileSync(new URL(`../${percorso}`, import.meta.url), css);
        console.log(`scritto ${percorso} (${quante})`);
    }
}
