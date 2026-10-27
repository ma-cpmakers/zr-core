// Confronta i tipi di evento del contratto pubblicato di /v1 (x-eventi di ogni operazione) con la copia che i casi di Pest
// leggono, tests/contratto/x-eventi.json (sprint 79 · T2.2, voce 2820). Si lancia prima di ogni tag, da solo:
//
//   node scripts/tipi-del-contratto.mjs [indirizzo o file del contratto]
//
// (di norma https://docs.zeiras.com/v1/openapi.json). Esce con 0 se i tipi sono gli stessi; con 1, e l'elenco dei tipi nuovi e
// di quelli tolti, se no: un tipo nuovo entra nella copia insieme al suo titolo nelle lingue, o nell'elenco dei tipi che non
// arrivano alla campanella con la fonte del backoffice. Con 2 se il contratto non si legge, o non ha nessun tipo di evento.
// Il contratto non porta la versione del backoffice: lo script dice l'impronta dei tipi (sha256 dei tipi in ordine, uno per
// riga), la stessa che il caso di Pest scrive per la copia.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fonte = process.argv[2] ?? 'https://docs.zeiras.com/v1/openapi.json';
const copia = JSON.parse(readFileSync(new URL('../tests/contratto/x-eventi.json', import.meta.url), 'utf8'));

let contratto;
try {
    if (/^https?:\/\//.test(fonte)) {
        const risposta = await fetch(fonte, { signal: AbortSignal.timeout(30_000) });
        if (!risposta.ok) {
            throw new Error(`risposta ${risposta.status}`);
        }
        contratto = await risposta.json();
    } else {
        contratto = JSON.parse(readFileSync(fonte, 'utf8'));
    }
} catch (errore) {
    console.error(`Il contratto non si legge da ${fonte}: ${errore.message}`);
    process.exit(2);
}

const tipi = new Set();
const visita = (nodo) => {
    if (Array.isArray(nodo)) {
        nodo.forEach(visita);
    } else if (nodo && typeof nodo === 'object') {
        for (const [chiave, valore] of Object.entries(nodo)) {
            if (chiave === 'x-eventi' && Array.isArray(valore)) {
                valore.forEach((tipo) => tipi.add(tipo));
            } else {
                visita(valore);
            }
        }
    }
};
visita(contratto);
if (tipi.size === 0) {
    console.error(`Il contratto letto da ${fonte} non ha nessun tipo di evento (x-eventi).`);
    process.exit(2);
}

const nellaCopia = new Set(copia.tipi);
const nuovi = [...tipi].filter((tipo) => !nellaCopia.has(tipo)).sort();
const tolti = [...nellaCopia].filter((tipo) => !tipi.has(tipo)).sort();
const impronta = (elenco) => createHash('sha256').update([...elenco].sort().join('\n')).digest('hex');
console.log(`Contratto: ${tipi.size} tipi di evento, impronta ${impronta(tipi)}; copia (versione ${copia.versione}): ${nellaCopia.size}, impronta ${impronta(nellaCopia)}.`);
nuovi.forEach((tipo) => console.log(`+ ${tipo}`));
tolti.forEach((tipo) => console.log(`- ${tipo}`));
process.exit(nuovi.length || tolti.length ? 1 : 0);
