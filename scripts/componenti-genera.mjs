// Il testo di resources/js/zeiras/componenti.js da quello di resources/zeiras/bundle.js (il design system di Zeiras, copia
// derivata): gli stessi componenti come modulo ES, esportati per nome. Il bundle è una funzione che legge `window.React` e scrive
// tutto in `window.Zeiras`: chi lo importa li porta tutti nella build. Il modulo importa React da sé ed esporta ogni componente
// col suo nome, e la build di un frontend tiene solo quelli che l'app usa. Il corpo non si riscrive: è quello del bundle riga per
// riga (tranne tre righe segnate pure, sotto), senza le prime tre (il commento del formato, l'apertura della funzione, `var React = window.React;`) e senza la
// registrazione in `window.Zeiras` in fondo, al cui posto vanno gli `export`. Qui si conosce una forma sola del bundle, e la si
// controlla prima di comporre: se una cosa non torna un errore dice quale. Questo file lavora solo su testi, senza `node:fs`:
// lo importano il comando (scripts/componenti.mjs, che legge e scrive i file) e un caso di vitest, che i file li prende come
// testo (`?raw`).

const FORMATO = 4;
const SPAZIO_DEI_NOMI = 'Zeiras';
const INIZIO_DEL_COMMENTO = '/* @ds-bundle: ';
const COMMENTO_DEL_FORMATO = /^\/\* @ds-bundle: (\{.*\}) \*\/$/;
const APERTURA = '(function () {';
const REACT_DALLA_FINESTRA = '  var React = window.React;';
const INIZIO_DELLA_REGISTRAZIONE = `  window.${SPAZIO_DEI_NOMI} = Object.assign(window.${SPAZIO_DEI_NOMI} || {}, {`;
const FINE_DELLA_REGISTRAZIONE = '  });';
const CHIUSURA = '})();';
const COPPIA = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/;
// Le righe che il modulo segna pure (dalla `v2.11.5`): i dati di esempio di `CrmContacts` e i due formattatori dei numeri, che il
// bundle calcola appena caricato e che usano solo componenti che la cornice non usa. Senza il segno la build di un'app li tiene
// anche dove nessuno li usa, perché una chiamata può fare altro; col segno li toglie solo lì. Il segno va dopo l'uguale, davanti
// alla chiamata. Se una riga non c'è, o c'è due volte, lo script si ferma: un design system nuovo si riprenderebbe quei byte in
// silenzio.
// Le dichiarazioni che il modulo segna pure, con la forma intera che lo script conosce: l'inizio (il segno va dopo l'uguale) e,
// riga per riga, ciò che deve esserci. Una riga di testo è da avere com'è; `FILA` è una o più righe di una tabella di soli
// testi e numeri. Una riga diversa anche dopo l'uguale — una chiamata, un'altra funzione — ferma lo script: segnato puro, un
// valore con effetti perderebbe gli effetti dove non serve.
const FILA = /^ {4}\[(?:'[^'\\]*'|\d+)(?:, (?:'[^'\\]*'|\d+))*\],?$/;
const DA_SEGNARE = [
    ['  var NF = ', ["  var NF = new Intl.NumberFormat('it-IT');"]],
    ['  var EUR = ', ["  var EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });"]],
    ['  var SAMPLE_CONTACTS = ', [
        '  var SAMPLE_CONTACTS = [',
        FILA,
        "  ].map(function (r, i) { return { id: 'ct' + i, name: r[0], email: r[1], company: r[2], status: r[3], owner: r[4], value: r[5], last: r[6] }; });",
    ]],
];

/** Se dalla riga `da` di `righe` c'è la dichiarazione nella forma `forma`. */
function haLaForma(righe, da, forma) {
    let qui = da;
    for (const attesa of forma) {
        if (typeof attesa === 'string') {
            if (righe[qui++] !== attesa) return false;
            continue;
        }
        const prima = qui;
        while (qui < righe.length && attesa.test(righe[qui])) qui++;
        if (qui === prima) return false;
    }

    return true;
}
const PURO = '/* @__PURE__ */ ';
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

/**
 * Perché un testo non è un bundle intero: è vuoto, o si ferma a metà. `null` se non è né l'uno né l'altro, e allora che forma
 * ha lo dice `leggi`. Un bundle vuoto o troncato non è un bundle di un'altra forma: il rimedio è rimetterlo al suo posto, non
 * riallineare lo script. Si ferma a metà un testo che comincia come il bundle che lo script conosce — la riga 1 dichiara il
 * suo formato, o il testo è un pezzo di quella riga — e a cui manca la riga «})();». Un testo che quella riga la ha è intero:
 * se dopo ha un'altra coda (non finisce con l'a capo, ha una riga in più) è un bundle di un'altra forma, e rimetterlo al suo
 * posto lo ridarebbe uguale. Lo stesso per un altro formato dichiarato, intero o no, anche in un file di una riga sola.
 */
export function nonIntero(bundle) {
    if (bundle.trim() === '') return 'è vuoto';

    const righe = bundle.split('\n');
    const commento = COMMENTO_DEL_FORMATO.exec(righe[0]);
    // Un pezzo della riga 1: il commento del formato non è intero, e il testo ne è l'inizio.
    const dentroLaRigaUno = righe.length === 1 && commento === null && (righe[0].startsWith(INIZIO_DEL_COMMENTO) || INIZIO_DEL_COMMENTO.startsWith(righe[0]));
    let delFormato = false;
    try {
        delFormato = JSON.parse(commento?.[1] ?? 'null')?.format === FORMATO;
    } catch {
        // La riga 1 non porta un JSON: che cosa non torna lo dice `leggi`.
    }

    return (dentroLaRigaUno || delFormato) && !righe.includes(CHIUSURA) ? `si ferma a metà: manca la riga «${CHIUSURA}»` : null;
}

/**
 * Il corpo del bundle, riga per riga, coi segni «puri» di `DA_SEGNARE`, e i nomi che registra: solo se il bundle ha la forma che lo
 * script conosce.
 */
export function leggi(bundle) {
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

    for (const [inizio, forma] of DA_SEGNARE) {
        const dove = corpo.flatMap((riga, indice) => (riga.startsWith(inizio) ? [indice] : []));
        vuole(dove.length === 1, `la riga «${inizio.trim()} …», da segnare pura, c'è ${dove.length} volte`);
        vuole(haLaForma(corpo, dove[0], forma), `la riga «${inizio.trim()} …», da segnare pura, non è nella forma che lo script conosce (riga ${dove[0] + 4}): segnato puro, un valore che lo script non conosce può perdere i suoi effetti`);
        corpo[dove[0]] = inizio + PURO + corpo[dove[0]].slice(inizio.length);
    }

    return { corpo, nomi };
}

/** Il modulo: l'intestazione, il corpo del bundle com'è (tranne i segni «puri») e, al posto della registrazione, gli `export` coi nomi registrati. */
export function componi({ corpo, nomi }) {
    return [...INTESTAZIONE, ...corpo, 'export {', ...nomi.map((nome) => `  ${nome},`), '};', ''].join('\n');
}

/**
 * Il testo di resources/js/zeiras/componenti.js per questo bundle. Se il bundle non ha la forma che lo script conosce lancia un
 * errore che dice che cosa non torna.
 */
export function genera(bundle) {
    return componi(leggi(bundle));
}

// I componenti che hanno anche un modulo loro (dalla `v3.1.0`, Decisione 16375): chi li usa solo in una pagina a richiesta li
// prende da lì, e il JS d'ingresso non li porta. `componenti.js` è un modulo solo, e un modulo che l'ingresso importa sta
// nell'ingresso con tutto ciò che una qualunque pagina ne usa. Il modulo di un componente ha il suo blocco del bundle riga per
// riga — dal commento «/* ---------- <Nome>: …» alla graffa che chiude la funzione — e le righe private che il blocco usa, anche
// loro com'erano; i componenti che il bundle registra li prende da `./componenti` per nome. Da `componenti` il componente resta:
// nella stessa app si prende da un posto solo, perché le due copie hanno ognuna le sue righe private (il contatore degli id).
export const A_PARTE = ['MentionField'];

const INIZIO_DEL_BLOCCO = (nome) => `  /* ---------- ${nome}: `;
// Le dichiarazioni del corpo: le righe che cominciano con `var` o `function` col rientro del bundle, e su quelle righe ogni `var`
// o `function` fuori dalle graffe («var uid = 0; function useId…»); quelle dentro una funzione sono sue.
const RIGA_DI_DICHIARAZIONI = /^ {2}(?:var|function) /;
const DICHIARAZIONE = /^(?:var|function) ([A-Za-z_$][\w$]*)/;
const NOME_USATO = /(?<![.\w$])[A-Za-z_$][\w$]*/g;
const TESTO = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

const nomiUsati = (righe) => new Set(righe.join('\n').replace(TESTO, "''").match(NOME_USATO) ?? []);
function dichiaratiIn(riga) {
    if (!RIGA_DI_DICHIARAZIONI.test(riga)) return [];
    const senzaTesti = riga.replace(TESTO, "''");
    const dichiarati = [];
    let profondita = 0;
    for (let qui = 0; qui < senzaTesti.length; qui++) {
        const carattere = senzaTesti[qui];
        if (carattere === '{' || carattere === '(' || carattere === '[') profondita++;
        else if (carattere === '}' || carattere === ')' || carattere === ']') profondita--;
        else if (profondita === 0 && (qui === 0 || /[\s;]/.test(senzaTesti[qui - 1]))) {
            const trovato = DICHIARAZIONE.exec(senzaTesti.slice(qui));
            if (trovato) dichiarati.push(trovato[1]);
        }
    }

    return dichiarati;
}

/**
 * Il testo del modulo di `nome` (uno di `A_PARTE`) dal corpo e dai nomi che dà `leggi`. Se il blocco non c'è, o usa una riga
 * privata che non sta tutta su una riga sua, lancia un errore che dice quale.
 */
export function aParte({ corpo, nomi }, nome) {
    const inizi = corpo.flatMap((riga, indice) => (riga.startsWith(INIZIO_DEL_BLOCCO(nome)) ? [indice] : []));
    vuole(inizi.length === 1, `il commento «${INIZIO_DEL_BLOCCO(nome).trim()} …», da cui comincia il blocco di ${nome}, c'è ${inizi.length} volte`);
    const funzione = corpo.indexOf(`  function ${nome}(p) {`, inizi[0]);
    vuole(funzione > inizi[0], `dopo il commento del blocco di ${nome} non c'è la riga «function ${nome}(p) {»`);
    const fine = corpo.indexOf('  }', funzione);
    vuole(fine > funzione, `la funzione ${nome} non si chiude con una riga «}»`);
    const blocco = corpo.slice(inizi[0], fine + 1);

    // Dove sta ogni dichiarazione del corpo fuori dal blocco: un nome usato che è lì si porta con la sua riga, o si importa.
    const rigaDi = new Map();
    corpo.forEach((riga, indice) => {
        if (indice < inizi[0] || indice > fine) dichiaratiIn(riga).forEach((dichiarato) => rigaDi.set(dichiarato, indice));
    });
    const daImportare = new Set();
    const righePrivate = new Set();
    const daGuardare = [...nomiUsati(blocco)];
    while (daGuardare.length > 0) {
        const usato = daGuardare.pop();
        if (!rigaDi.has(usato) || daImportare.has(usato)) continue;
        if (nomi.includes(usato)) {
            daImportare.add(usato);
            continue;
        }
        const indice = rigaDi.get(usato);
        if (righePrivate.has(indice)) continue;
        const riga = corpo[indice];
        vuole(/[;}]$/.test(riga) && (!/^ {2}function /.test(riga) || riga.endsWith('}')) && (riga.split('{').length === riga.split('}').length), `${nome} usa «${usato}», che non sta tutto sulla riga ${indice + 4} del bundle: lo script porta nel modulo di ${nome} solo righe private intere`);
        righePrivate.add(indice);
        daGuardare.push(...nomiUsati([riga]));
    }

    return [
        `// Generato da scripts/componenti.mjs: non si ritocca a mano. È ${nome} di resources/zeiras/bundle.js (il design system di`,
        '// Zeiras, copia derivata) in un modulo suo: il suo blocco del bundle e le righe private che usa, riga per riga; i componenti che',
        '// usa li prende da ./componenti. A un riallineamento si rigenera con `npm run componenti`.',
        "import * as React from 'react';",
        ...(daImportare.size > 0 ? [`import { ${[...daImportare].sort().join(', ')} } from './componenti';`] : []),
        ...[...righePrivate].sort((a, b) => a - b).map((indice) => corpo[indice]),
        '',
        ...blocco,
        '',
        `export { ${nome} };`,
        '',
    ].join('\n');
}
