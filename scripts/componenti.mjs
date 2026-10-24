// Il comando che genera resources/js/zeiras/componenti.js da resources/zeiras/bundle.js (il design system di Zeiras, copia
// derivata), e accanto il modulo di ogni componente di `A_PARTE` (dalla `v3.1.0`: resources/js/zeiras/MentionField.js):
// `npm run componenti` scrive i file; `npm run componenti -- --controlla` non scrive: rigenera in memoria, confronta coi file ed
// esce 1 se uno non è uguale. Lo lancia la CI a ogni giro. I file non si ritoccano a mano: si rigenerano quando il bundle
// cambia. Se il bundle non ha la forma che lo script conosce dice che cosa non torna ed esce 1, senza scrivere niente; se manca,
// non si legge, è vuoto o si ferma a metà lo dice, ed esce 1 allo stesso modo. Come dal bundle si arriva al modulo lo dice
// scripts/componenti-genera.mjs, che lavora solo su testi. Questo file è solo il comando: fa sempre il suo lavoro, da qualunque
// cartella lo si lanci, e non c'è niente da importare (chi vuole `genera` lo prende di là).

import { readFileSync, writeFileSync } from 'node:fs';
import { A_PARTE, aParte, componi, leggi, nonIntero } from './componenti-genera.mjs';

const qui = (percorso) => new URL(`../${percorso}`, import.meta.url);
const fileDelBundle = 'resources/zeiras/bundle.js';
const fileDelModulo = 'resources/js/zeiras/componenti.js';

// Un bundle che manca, che non si lascia leggere, che è vuoto o che si ferma a metà non è un bundle di un'altra forma: il
// rimedio è rimetterlo al suo posto, non toccare lo script. Per questo le due cose si provano una alla volta, ognuna col suo
// messaggio.
let testo;
try {
    testo = readFileSync(qui(fileDelBundle), 'utf8');
    const perche = nonIntero(testo);
    if (perche !== null) throw new Error(perche);
} catch (errore) {
    console.error(`${fileDelBundle}: non si legge (${errore.message}).\n${fileDelModulo} non è stato scritto: il bundle è la copia derivata del design system, e va rimesso al suo posto.`);
    process.exit(1);
}
let letto;
try {
    letto = leggi(testo);
} catch (errore) {
    console.error(`${fileDelBundle}: ${errore.message}\n${fileDelModulo} non è stato scritto: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}
// Il modulo dei componenti per primo, poi quelli di `A_PARTE`: ognuno col suo testo e con ciò che si dice quando è a posto.
let file;
try {
    file = [
        [fileDelModulo, componi(letto), `${letto.nomi.length} nomi esportati`],
        ...Object.keys(A_PARTE).map((nome) => [`resources/js/zeiras/${nome}.js`, aParte(letto, nome), nome]),
    ];
} catch (errore) {
    console.error(`${fileDelBundle}: ${errore.message}\nNessun file è stato scritto: né ${[fileDelModulo, ...Object.keys(A_PARTE).map((nome) => `resources/js/zeiras/${nome}.js`)].join(' né ')}: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}

if (process.argv.includes('--controlla')) {
    const diversi = file.filter(([percorso, modulo]) => {
        let scritto = null;
        try {
            scritto = readFileSync(qui(percorso), 'utf8');
        } catch {
            // Il file che manca non è quello che il bundle genera: lo dice il confronto qui sotto.
        }
        if (scritto === modulo) return false;
        console.error(`${percorso} non è quello che ${fileDelBundle} genera${scritto === null ? ' (il file non c\'è)' : ''}.\nEsce solo da \`npm run componenti\`: non si ritocca a mano, e si rigenera quando il bundle cambia.`);

        return true;
    });
    if (diversi.length > 0) process.exit(1);
    file.forEach(([percorso, , quanti]) => console.log(`${percorso}: è quello che ${fileDelBundle} genera (${quanti})`));
} else {
    file.forEach(([percorso, modulo, quanti]) => {
        writeFileSync(qui(percorso), modulo);
        console.log(`scritto ${percorso} (${quanti})`);
    });
}
