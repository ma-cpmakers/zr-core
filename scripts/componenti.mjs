// Il comando che genera resources/js/zeiras/componenti.js da resources/zeiras/bundle.js (il design system di Zeiras, copia
// derivata): `npm run componenti` scrive il file; `npm run componenti -- --controlla` non scrive: rigenera in memoria, confronta
// col file ed esce 1 se non sono uguali. Lo lancia la CI a ogni giro. Il file non si ritocca a mano: si rigenera quando il bundle
// cambia. Se il bundle non ha la forma che lo script conosce dice che cosa non torna ed esce 1, senza scrivere niente. Come dal
// bundle si arriva al modulo lo dice scripts/componenti-genera.mjs, che lavora solo su testi. Questo file è solo il comando: fa
// sempre il suo lavoro, da qualunque cartella lo si lanci, e non c'è niente da importare (chi vuole `genera` lo prende di là).

import { readFileSync, writeFileSync } from 'node:fs';
import { componi, leggi } from './componenti-genera.mjs';

const qui = (percorso) => new URL(`../${percorso}`, import.meta.url);
const fileDelBundle = 'resources/zeiras/bundle.js';
const fileDelModulo = 'resources/js/zeiras/componenti.js';

let letto;
try {
    letto = leggi(readFileSync(qui(fileDelBundle), 'utf8'));
} catch (errore) {
    console.error(`${fileDelBundle}: ${errore.message}\n${fileDelModulo} non è stato scritto: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}
const modulo = componi(letto);
const quanti = `${letto.nomi.length} nomi esportati`;

if (process.argv.includes('--controlla')) {
    let scritto = null;
    try {
        scritto = readFileSync(qui(fileDelModulo), 'utf8');
    } catch {
        // Il file che manca non è quello che il bundle genera: lo dice il confronto qui sotto.
    }
    if (scritto !== modulo) {
        console.error(`${fileDelModulo} non è quello che ${fileDelBundle} genera${scritto === null ? ' (il file non c\'è)' : ''}.\nEsce solo da \`npm run componenti\`: non si ritocca a mano, e si rigenera quando il bundle cambia.`);
        process.exit(1);
    }
    console.log(`${fileDelModulo}: è quello che ${fileDelBundle} genera (${quanti})`);
} else {
    writeFileSync(qui(fileDelModulo), modulo);
    console.log(`scritto ${fileDelModulo} (${quanti})`);
}
