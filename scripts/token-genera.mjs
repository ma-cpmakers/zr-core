// Ciò che scripts/token-css.mjs scrive, come funzioni dei token del design system (resources/zeiras/tokens.json): così i casi di
// vitest provano il generatore anche con token che il file non ha. Dalla v5.0.0 (voce #3536) le funzioni sono qui e lo script
// scrive i due file: le variabili (zeiras-token.css) e il tema di Tailwind 4 coi loro nomi (zeiras-tailwind.css).

const stiliDiTesto = (token) => token.type.groups.flatMap((gruppo) => gruppo.styles);

const valore = (testo) => String(testo).replace(/^\{([a-z0-9-]+)\}$/, 'var(--$1)');

/** Le variabili di zeiras-token.css, `[nome, valore]`, nell'ordine del file. */
export function variabiliDeiToken(token) {
    return [
        ...[token.color, token.shadow].flatMap((gruppo) => gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value.light)])),
        ...[token.spacing, token.radius, token.layout, token.zIndex, token.border].flatMap((gruppo) =>
            gruppo.tokens.map(({ name, value }) => [`--${name}`, valore(value)]),
        ),
        ...Object.entries(token.type.families).map(([famiglia, testo]) => [`--font-${famiglia}`, valore(testo)]),
        ...variabiliDiTesto(token),
    ];
}

/** Le variabili degli stili di testo, coi nomi del tema di Tailwind 4: misura, interlinea, peso e, dove c'è, spaziatura. */
function variabiliDiTesto(token) {
    return stiliDiTesto(token).flatMap(({ name, fontSize, lineHeight, fontWeight, letterSpacing }) => [
        [`--text-${name}`, fontSize],
        [`--text-${name}--line-height`, lineHeight],
        [`--text-${name}--font-weight`, fontWeight],
        ...(letterSpacing === undefined ? [] : [[`--text-${name}--letter-spacing`, letterSpacing]]),
    ]);
}

/**
 * Il tema scuro (dalla v4.36.0, voce #3757): solo i colori e le ombre il cui valore scuro è diverso dal chiaro, `[nome, valore]`
 * (`{pine}` resta `var(--pine)`, che cambia da sé).
 */
export function scureDeiToken(token) {
    return [token.color, token.shadow]
        .flatMap((gruppo) => gruppo.tokens)
        .filter(({ value }) => value.dark !== undefined && value.dark !== value.light)
        .map(({ name, value }) => [`--${name}`, valore(value.dark)]);
}

const blocco = (rientro, righe) => righe.map(([nome, testo]) => `${rientro}${nome}: ${testo};`).join('\n');

/**
 * resources/css/zeiras-token.css: le variabili dei token nel `:root`, col tema chiaro; dalla v4.36.0 il tema scuro con
 * `:root[data-theme="dark"]` e, dentro `@media (prefers-color-scheme: dark)`, con `:root[data-theme="system"]`.
 */
export function cssDeiToken(token) {
    const scure = scureDeiToken(token);
    return `/* Generato da scripts/token-css.mjs da resources/zeiras/tokens.json: non si modifica a mano, si rigenera con
   \`npm run token\` a ogni riallineamento al design system. Il tema chiaro, e dalla v4.36.0 il tema scuro: con
   data-theme="dark" su <html>, o con data-theme="system" quando il sistema è scuro. Si carica dopo bundle.css. */
:root {
    color-scheme: light;
${blocco('    ', variabiliDeiToken(token))}
}
:root[data-theme="dark"] {
    color-scheme: dark;
${blocco('    ', scure)}
}
@media (prefers-color-scheme: dark) {
    :root[data-theme="system"] {
        color-scheme: dark;
${blocco('        ', scure)}
    }
}
`;
}

/**
 * Le variabili del tema di Tailwind 4, `[nome nel tema, variabile di zeiras-token.css]` (voce #3536): ogni colore (`bg-surface`,
 * `text-ink-muted`, `border-line`), le due famiglie (`font-display`), i raggi (`rounded-md`: il token è `radius-md`), le ombre
 * (`shadow-card`) e gli stili di testo (`text-heading-1`, con interlinea, peso e spaziatura delle lettere). Ogni valore è la
 * variabile del token, mai il valore.
 */
export function temaDeiToken(token) {
    const daTema = (prefisso, nome) => [`--${prefisso}-${nome.replace(new RegExp(`^${prefisso}-`), '')}`, `var(--${nome})`];

    return [
        ...token.color.tokens.map(({ name }) => daTema('color', name)),
        ...Object.keys(token.type.families).map((famiglia) => [`--font-${famiglia}`, `var(--font-${famiglia})`]),
        ...token.radius.tokens.map(({ name }) => daTema('radius', name)),
        ...token.shadow.tokens.map(({ name }) => daTema('shadow', name)),
        // Gli stili di testo dal loro gruppo, non dal nome: un colore che si chiamasse `text-…` non diventa una misura.
        ...variabiliDiTesto(token).map(([nome]) => [nome, `var(${nome})`]),
    ];
}

/** resources/css/zeiras-tailwind.css: il tema di Tailwind 4 coi nomi dei token, `inline reference` (non scrive niente nella pagina). */
export function cssPerTailwind(token) {
    return `/* Generato da scripts/token-css.mjs da resources/zeiras/tokens.json: non si modifica a mano, si rigenera con
   \`npm run token\` a ogni riallineamento al design system. Il tema di Tailwind 4 coi nomi dei token (voce #3536): un modulo lo
   importa dopo \`tailwindcss\`, e ogni classe legge la variabile del token da zeiras-token.css. Con \`reference\` il tema non
   scrive niente nella pagina; con \`inline\` la classe porta \`var(--…)\`, non il valore. */
@theme inline reference {
${temaDeiToken(token).map(([nome, testo]) => `    ${nome}: ${testo};`).join('\n')}
}
`;
}
