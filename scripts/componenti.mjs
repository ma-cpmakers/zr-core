// Genera resources/js/zeiras/componenti.js da resources/zeiras/bundle.js (il design system di Zeiras, copia derivata): gli stessi
// componenti come modulo ES, esportati per nome. Il bundle è una funzione che legge `window.React` e scrive tutto in
// `window.Zeiras`: chi lo importa li porta tutti nella build. Il modulo importa React da sé ed esporta ogni componente col suo
// nome, e la build di un frontend tiene solo quelli che l'app usa. Il corpo non si riscrive: è quello del bundle riga per riga,
// senza le prime tre (il commento del formato, l'apertura della funzione, `var React = window.React;`) e senza la registrazione
// in `window.Zeiras` in fondo, al cui posto vanno gli `export`. Lo script conosce una forma sola del bundle e la controlla prima
// di scrivere: se una cosa non torna dice quale ed esce 1, senza scrivere niente. Il file non si ritocca a mano: si rigenera con
// `npm run componenti` quando il bundle cambia. `npm run componenti -- --controlla` non scrive: rigenera in memoria, confronta
// col file ed esce 1 se non sono uguali. Lo lancia la CI a ogni giro.

const FORMATO = 4;
const SPAZIO_DEI_NOMI = 'Zeiras';
const COMMENTO_DEL_FORMATO = /^\/\* @ds-bundle: (\{.*\}) \*\/$/;
const APERTURA = '(function () {';
const REACT_DALLA_FINESTRA = '  var React = window.React;';
const INIZIO_DELLA_REGISTRAZIONE = `  window.${SPAZIO_DEI_NOMI} = Object.assign(window.${SPAZIO_DEI_NOMI} || {}, {`;
const FINE_DELLA_REGISTRAZIONE = '  });';
const CHIUSURA = '})();';
const COPPIA = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/;
// Ciò che il modulo non può più leggere: `window.React` non è detto che ci sia, e `window.Zeiras` lo scrive chi importa il modulo.
const DALLA_FINESTRA = [/\bwindow\.React\b/, new RegExp(`\\bwindow\\.${SPAZIO_DEI_NOMI}\\b`)];

const INTESTAZIONE = [
    '// Generato da scripts/componenti.mjs: non si ritocca a mano. Sono i componenti di resources/zeiras/bundle.js (il design system',
    '// di Zeiras, copia derivata) come modulo ES, esportati per nome; a un riallineamento si rigenera con `npm run componenti`.',
    "import * as React from 'react';",
];

/** Si ferma dicendo che cosa, nel bundle, non è come lo script lo conosce. */
function vuole(condizione, cheCosa) {
    if (!condizione) throw new Error(`forma inattesa del bundle: ${cheCosa}`);
}

/** Il corpo del bundle, riga per riga, e i nomi che registra: solo se il bundle ha la forma che lo script conosce. */
function leggi(bundle) {
    const righe = bundle.split('\n');

    const formato = COMMENTO_DEL_FORMATO.exec(righe[0] ?? '');
    vuole(formato !== null, 'la riga 1 non è il commento «/* @ds-bundle: {…} */»');
    let dichiarato;
    try {
        dichiarato = JSON.parse(formato[1]);
    } catch {
        vuole(false, 'la riga 1 non porta un JSON dopo «@ds-bundle:»');
    }
    vuole(dichiarato.format === FORMATO, `la riga 1 dichiara il formato ${dichiarato.format}, lo script conosce il ${FORMATO}`);
    vuole(dichiarato.namespace === SPAZIO_DEI_NOMI, `la riga 1 dichiara lo spazio dei nomi «${dichiarato.namespace}», lo script conosce «${SPAZIO_DEI_NOMI}»`);
    vuole(righe[1] === APERTURA, `la riga 2 non è «${APERTURA}»`);
    vuole(righe[2] === REACT_DALLA_FINESTRA, `la riga 3 non è «${REACT_DALLA_FINESTRA}»`);

    const inizi = righe.flatMap((riga, indice) => (riga === INIZIO_DELLA_REGISTRAZIONE ? [indice] : []));
    vuole(inizi.length > 0, `la registrazione «${INIZIO_DELLA_REGISTRAZIONE.trim()}» non c'è`);
    vuole(inizi.length === 1, `la registrazione «${INIZIO_DELLA_REGISTRAZIONE.trim()}» c'è ${inizi.length} volte`);
    const inizio = inizi[0];
    const fine = righe.indexOf(FINE_DELLA_REGISTRAZIONE, inizio);
    vuole(fine > inizio, `la registrazione non si chiude con «${FINE_DELLA_REGISTRAZIONE.trim()}»`);
    const coda = righe.slice(fine + 1);
    vuole(coda.length === 2 && coda[0] === CHIUSURA && coda[1] === '', `dopo la registrazione non c'è la sola riga «${CHIUSURA}»`);

    const nomi = [];
    for (const coppia of righe.slice(inizio + 1, fine).join(' ').split(',').map((pezzo) => pezzo.trim()).filter((pezzo) => pezzo !== '')) {
        const trovata = COPPIA.exec(coppia);
        vuole(trovata !== null && trovata[1] === trovata[2], `nella registrazione «${coppia}» non è una coppia «Nome: Nome»`);
        nomi.push(trovata[1]);
    }
    vuole(nomi.length > 0, 'la registrazione è vuota');
    const doppio = nomi.find((nome, indice) => nomi.indexOf(nome) !== indice);
    vuole(doppio === undefined, `nella registrazione «${doppio}» c'è ${nomi.filter((nome) => nome === doppio).length} volte`);

    const corpo = righe.slice(3, inizio);
    corpo.forEach((riga, indice) => {
        const letta = DALLA_FINESTRA.map((regola) => regola.exec(riga)).find((trovata) => trovata !== null);
        vuole(letta === undefined, `la riga ${indice + 4} nomina «${letta?.[0]}», che un modulo non può leggere dalla finestra`);
    });

    return { corpo, nomi };
}

/** Il modulo: l'intestazione, il corpo del bundle com'è e, al posto della registrazione, gli `export` coi nomi registrati. */
function componi({ corpo, nomi }) {
    return [...INTESTAZIONE, ...corpo, 'export {', ...nomi.map((nome) => `  ${nome},`), '};', ''].join('\n');
}

/**
 * Il testo di resources/js/zeiras/componenti.js per questo bundle. Se il bundle non ha la forma che lo script conosce lancia un
 * errore che dice che cosa non torna.
 */
export function genera(bundle) {
    return componi(leggi(bundle));
}

// Da riga di comando (`node scripts/componenti.mjs`), non quando un caso di vitest importa `genera`: lì `node:fs` non c'è, e
// per questo si importa solo qui dentro.
if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    const { readFileSync, writeFileSync } = await import('node:fs');
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
}
