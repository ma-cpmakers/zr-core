// I tipi di scripts/componenti-genera.mjs per i casi di vitest che ne importano le funzioni (resources/js/zeiras/componenti.test.ts
// e, dalla `v3.3.0`, stili.test.ts).

/** Il corpo del bundle, riga per riga coi segni «puri», e i nomi che registra; se il bundle non ha la forma che lo script conosce lancia un errore. */
export function leggi(bundle: string): { corpo: string[]; nomi: string[] };

/** I file dei moduli dei componenti per questo bundle, da resources/js/zeiras (`componenti.js`, `<Nome>.js`, `interni/<nome>.js`), senza gli import degli stili. */
export function genera(bundle: string): Record<string, string>;

/**
 * I moduli dei componenti (dalla `v4.28.0`, voce #3511): per ogni file, da resources/js/zeiras, il suo testo; con `divisi` (da
 * `dividiIlCss`) gli import degli stili dei componenti di cui un modulo usa le classi. Se il bundle non ha la forma che lo script
 * conosce lancia un errore che dice che cosa non torna.
 */
export function moduli(letto: { corpo: string[]; nomi: string[] }, divisi?: { proprie: Record<string, string[]> }): Record<string, string>;

/** I componenti coi loro stili in resources/css/zeiras/<Nome>.css (dalla `v3.3.0`). */
export const STILI_A_PARTE: readonly string[];

/** Il bundle CSS diviso (dalla `v3.3.0`): `zeiras` senza gli stili dei componenti di `STILI_A_PARTE`, `stili` di ognuno, `proprie` le classi che solo i suoi stili definiscono. */
export function dividiIlCss(css: string): { zeiras: string; stili: Record<string, string>; proprie: Record<string, string[]> };

/** Il CSS del bundle coi font del pacchetto (dalla `v3.15.0`): l'`@import` di Google diventa quello di font.css; se il bundle chiede a Google altri font lancia un errore. */
export function coiFontDelPacchetto(css: string): string;

/** Il testo di resources/css/bundle.css (dalla `v3.15.0`): il bundle intero coi font del pacchetto, sotto il commento che lo dice generato. */
export function bundleIntero(css: string): string;
