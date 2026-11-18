// I tipi di scripts/token-genera.mjs per i casi di vitest che ne importano le funzioni (dalla `v5.0.0`, voce #3536).

/** I token del design system, come li legge scripts/token-genera.mjs (resources/zeiras/tokens.json). */
export type Token = Record<string, unknown>;

/** Le variabili di zeiras-token.css, `[nome, valore]`, nell'ordine del file. */
export function variabiliDeiToken(token: Token): [string, string][];

/** Il tema scuro (dalla `v4.36.0`, #3757): `[nome, valore scuro]` dei colori e delle ombre che cambiano. */
export function scureDeiToken(token: Token): [string, string][];

/** Il testo di resources/css/zeiras-token.css, col tema chiaro e lo scuro. */
export function cssDeiToken(token: Token): string;

/** Il tema di Tailwind 4 (dalla `v5.0.0`, #3536): `[nome nel tema, variabile del token]`. */
export function temaDeiToken(token: Token): [string, string][];

/** Il testo di resources/css/zeiras-tailwind.css (dalla `v5.0.0`, #3536). */
export function cssPerTailwind(token: Token): string;
