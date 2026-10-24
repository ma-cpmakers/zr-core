// I tipi di scripts/componenti-genera.mjs per i casi di vitest che ne importano le funzioni (resources/js/zeiras/componenti.test.ts
// e MentionField.test.tsx).

/** Il corpo del bundle, riga per riga coi segni «puri», e i nomi che registra; se il bundle non ha la forma che lo script conosce lancia un errore. */
export function leggi(bundle: string): { corpo: string[]; nomi: string[] };

/**
 * Il testo di resources/js/zeiras/componenti.js per questo bundle. Se il bundle non ha la forma che lo script conosce lancia un
 * errore che dice che cosa non torna.
 */
export function genera(bundle: string): string;

/** I componenti che hanno anche un modulo loro, resources/js/zeiras/<Nome>.js (dalla `v3.1.0`). */
export const A_PARTE: readonly string[];

/** Il testo del modulo di `nome` (uno di `A_PARTE`) da ciò che dà `leggi`; se il blocco non c'è, o usa una riga privata spezzata, lancia un errore. */
export function aParte(letto: { corpo: string[]; nomi: string[] }, nome: string): string;
