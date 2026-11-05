// I tipi di scripts/componenti-genera.mjs per i casi di vitest che ne importano le funzioni (resources/js/zeiras/componenti.test.ts
// e MentionField.test.tsx; dalla `v3.3.0` stili.test.ts).

/** Il corpo del bundle, riga per riga coi segni «puri», e i nomi che registra; se il bundle non ha la forma che lo script conosce lancia un errore. */
export function leggi(bundle: string): { corpo: string[]; nomi: string[] };

/**
 * Il testo di resources/js/zeiras/componenti.js per questo bundle. Se il bundle non ha la forma che lo script conosce lancia un
 * errore che dice che cosa non torna.
 */
export function genera(bundle: string): string;

/** I componenti che hanno anche un modulo loro, resources/js/zeiras/<Nome>.js (dalla `v3.1.0`). */
export const A_PARTE: Readonly<Record<string, readonly string[]>>;

/** I componenti di `A_PARTE` che nel bundle stanno in un gruppo con altri, senza commento suo e coi loro stili in zeiras.css (dalla `v4.8.1`). */
export const NEL_GRUPPO: readonly string[];

/** I componenti di `A_PARTE` coi loro stili in resources/css/zeiras/<Nome>.css: tutti tranne quelli di `NEL_GRUPPO`. */
export const CON_GLI_STILI_A_PARTE: readonly string[];

/** Il bundle CSS diviso (dalla `v3.3.0`): `zeiras` senza gli stili dei componenti di `A_PARTE`, `stili` di ognuno, `proprie` le classi che solo i suoi stili definiscono. */
export function dividiIlCss(css: string): { zeiras: string; stili: Record<string, string>; proprie: Record<string, string[]> };

/**
 * Il testo del modulo di `nome` (una chiave di `A_PARTE`) da ciò che dà `leggi`, e con `divisi` (da `dividiIlCss`) gli import
 * degli stili dei componenti di cui usa le classi; se il blocco non c'è, o usa una riga privata spezzata, lancia un errore.
 */
export function aParte(letto: { corpo: string[]; nomi: string[] }, nome: string, divisi?: { proprie: Record<string, string[]> }): string;

/** Il CSS del bundle coi font del pacchetto (dalla `v3.15.0`): l'`@import` di Google diventa quello di font.css; se il bundle chiede a Google altri font lancia un errore. */
export function coiFontDelPacchetto(css: string): string;

/** Il testo di resources/css/bundle.css (dalla `v3.15.0`): il bundle intero coi font del pacchetto, sotto il commento che lo dice generato. */
export function bundleIntero(css: string): string;
