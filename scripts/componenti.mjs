// Il comando che genera da resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) i moduli di resources/js/zeiras:
// dalla `v4.30.0` (voce #3511) uno per ogni nome che il bundle registra, `<Nome>.js`, le righe private comuni a più nomi in
// `interni/`, e `componenti.js` che li esporta per nome; dalla `v3.3.0` divide anche resources/zeiras/bundle.css in
// resources/css/zeiras.css e negli stili di ogni componente di `STILI_A_PARTE` (resources/css/zeiras/<Nome>.css), che il modulo
// che ne usa le classi importa; dalla `v3.15.0` scrive anche resources/css/bundle.css, il bundle
// intero, e in tutti e due i font sono quelli del pacchetto (resources/css/font.css), non quelli di Google Fonts:
// `npm run componenti` scrive i file; `npm run componenti -- --controlla` non scrive: rigenera in memoria, confronta coi file ed
// esce 1 se uno non è uguale, o se in resources/js/zeiras (o in interni/) c'è un modulo `.js` che il bundle non genera: uno
// scritto a mano, o rimasto da un bundle di prima (`npm run componenti` lo toglie). Lo lancia la CI a ogni giro. I file non si ritoccano a mano: si rigenerano quando il bundle
// cambia. Se il bundle non ha la forma che lo script conosce dice che cosa non torna ed esce 1, senza scrivere niente; se manca,
// non si legge, è vuoto o si ferma a metà lo dice, ed esce 1 allo stesso modo. Come dal bundle si arriva al modulo lo dice
// scripts/componenti-genera.mjs, che lavora solo su testi. Questo file è solo il comando: fa sempre il suo lavoro, da qualunque
// cartella lo si lanci, e non c'è niente da importare (chi vuole `genera` lo prende di là).

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { STILI_A_PARTE, bundleIntero, dividiIlCss, leggi, moduli, nonIntero } from './componenti-genera.mjs';

const qui = (percorso) => new URL(`../${percorso}`, import.meta.url);
const fileDelBundle = 'resources/zeiras/bundle.js';
const fileDelModulo = 'resources/js/zeiras/componenti.js';
const fileDelCss = 'resources/zeiras/bundle.css';

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
let css;
try {
    css = readFileSync(qui(fileDelCss), 'utf8');
    if (css.trim() === '') throw new Error('è vuoto');
} catch (errore) {
    console.error(`${fileDelCss}: non si legge (${errore.message}).\nNessun file è stato scritto: il bundle è la copia derivata del design system, e va rimesso al suo posto.`);
    process.exit(1);
}
let letto;
try {
    letto = leggi(testo);
} catch (errore) {
    console.error(`${fileDelBundle}: ${errore.message}\n${fileDelModulo} non è stato scritto: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}
let divisi;
try {
    divisi = dividiIlCss(css);
} catch (errore) {
    console.error(`${fileDelCss}: ${errore.message}\nNessun file è stato scritto: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}
// I moduli dei componenti per primi, poi i CSS: ognuno col suo testo, con ciò che si dice quando è a posto e col file del bundle
// da cui viene.
let file;
try {
    const deiModuli = moduli(letto, divisi);
    file = [
        ...Object.entries(deiModuli).map(([nome, modulo]) => [`resources/js/zeiras/${nome}`, modulo, nome === 'componenti.js' ? `${letto.nomi.length} nomi esportati` : 'un modulo', fileDelBundle]),
        ['resources/css/zeiras.css', divisi.zeiras, `senza gli stili di ${STILI_A_PARTE.join(' e di ')}`, fileDelCss],
        ['resources/css/bundle.css', bundleIntero(css), 'il bundle intero coi font del pacchetto, movimento.css e avanzamento.css', fileDelCss],
        ...STILI_A_PARTE.map((nome) => [`resources/css/zeiras/${nome}.css`, divisi.stili[nome], `gli stili di ${nome}`, fileDelCss]),
    ];
} catch (errore) {
    console.error(`${fileDelBundle}: ${errore.message}\nNessun file è stato scritto: né ${fileDelModulo} né gli altri moduli di resources/js/zeiras: lo script va riallineato alla forma nuova del bundle.`);
    process.exit(1);
}
// I moduli `.js` che stanno in resources/js/zeiras e in interni/ e che il bundle non genera.
const generati = new Set(file.map(([percorso]) => percorso));
const inPiu = ['resources/js/zeiras', 'resources/js/zeiras/interni'].flatMap((cartella) => {
    let nomi = [];
    try {
        nomi = readdirSync(qui(cartella));
    } catch {
        // Una cartella che non c'è non ha moduli in più.
    }

    return nomi.filter((nome) => nome.endsWith('.js')).map((nome) => `${cartella}/${nome}`).filter((percorso) => !generati.has(percorso));
});

if (process.argv.includes('--controlla')) {
    const diversi = file.filter(([percorso, modulo, , origine]) => {
        let scritto = null;
        try {
            scritto = readFileSync(qui(percorso), 'utf8');
        } catch {
            // Il file che manca non è quello che il bundle genera: lo dice il confronto qui sotto.
        }
        if (scritto === modulo) return false;
        console.error(`${percorso} non è quello che ${origine} genera${scritto === null ? ' (il file non c\'è)' : ''}.\nEsce solo da \`npm run componenti\`: non si ritocca a mano, e si rigenera quando il bundle cambia.`);

        return true;
    });
    inPiu.forEach((percorso) => console.error(`${percorso} non è un modulo che ${fileDelBundle} genera: scritto a mano, o rimasto da un bundle di prima.\n\`npm run componenti\` lo toglie.`));
    if (diversi.length > 0 || inPiu.length > 0) process.exit(1);
    const deiModuli = file.filter(([percorso]) => percorso.startsWith('resources/js/zeiras/')).length;
    file.filter(([percorso]) => !percorso.startsWith('resources/js/zeiras/') || percorso === fileDelModulo).forEach(([percorso, , quanti, origine]) => console.log(`${percorso}: è quello che ${origine} genera (${quanti})`));
    console.log(`resources/js/zeiras: ${deiModuli} moduli, tutti quelli che ${fileDelBundle} genera e nessun altro`);
} else {
    inPiu.forEach((percorso) => {
        rmSync(qui(percorso));
        console.log(`tolto ${percorso} (il bundle non lo genera più)`);
    });
    file.forEach(([percorso, modulo]) => {
        mkdirSync(new URL('.', qui(percorso)), { recursive: true });
        writeFileSync(qui(percorso), modulo);
    });
    const deiModuli = file.filter(([percorso]) => percorso.startsWith('resources/js/zeiras/')).length;
    console.log(`scritti ${deiModuli} moduli in resources/js/zeiras (${letto.nomi.length} nomi esportati da componenti.js) e ${file.length - deiModuli} CSS`);
}
