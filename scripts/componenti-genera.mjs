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
// riga — dal commento «/* ---------- <Nome>: …» alla graffa che chiude la funzione, con ciò che il blocco dichiara (per
// MentionField anche `MENTION_LABELS`, che il modulo ha suo) — e le righe private che il blocco usa, nell'ordine del bundle; i
// componenti che il bundle registra li prende da `./componenti` per nome. Da `componenti` il componente resta: nella stessa app
// si prende da un posto solo.
// Le righe private che un modulo porta sono queste, guardate una per una: una riga con uno stato (un contesto, una cache)
// copiata darebbe alla copia uno stato suo, e il componente non vedrebbe più quello di `componenti`. `uid` è guardata: le due
// copie contano gli id ognuna per sé, e la regola del posto solo lo evita. Se il blocco usa una riga privata che qui non c'è, o
// non usa più una di queste, lo script si ferma e dice quale: la riga si guarda e l'elenco si riallinea.
export const A_PARTE = {
    MentionField: [
        '  var h = React.createElement;',
        '  var useState = React.useState;',
        '  var useRef = React.useRef;',
        "  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }",
        "  var uid = 0; function useId(prefix) { var r = useRef(null); if (!r.current) { uid += 1; r.current = (prefix || 'zr') + '-' + uid; } return r.current; }",
    ],
};

const INIZIO_DEL_BLOCCO = (nome) => `  /* ---------- ${nome}: `;
const NOME = '[A-Za-z_$][\\w$]*';
// Le forme che una riga del corpo col rientro del bundle (due spazi) può avere: una dichiarazione `var` o `function` di un nome
// solo, un commento, una chiusura (`}`, `};`, `];`, `].map(…`), un nome dato a una proprietà di un altro (`Avatar.Stack =
// AvatarStack;`). Ogni altra forma — `const`, `let`, `var { … } =`, un'istruzione — ferma lo script: un nome dichiarato in una
// forma che lo script non legge sparirebbe dal modulo senza errore.
const FORME = [new RegExp(`^ {2}var ${NOME} = `), new RegExp(`^ {2}function ${NOME}\\(`), /^ {2}\/[*/]/, /^ {2}[}\]]/, new RegExp(`^ {2}(${NOME})\\.${NOME} = ${NOME};$`)];
const DICHIARAZIONE = new RegExp(`^(?:var|function) (${NOME})`);
// Un nome usato: non dopo un punto (una proprietà), fuori dai testi e dai commenti.
const NOME_USATO = /(?<![.\w$])[A-Za-z_$][\w$]*/g;
const TESTO = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
const COMMENTO = /\/\*.*?\*\/|\/\/.*$/gm;

const senzaTestiNeCommenti = (testo) => testo.replace(TESTO, "''").replace(COMMENTO, ' ');
const nomiUsati = (righe) => new Set(senzaTestiNeCommenti(righe.join('\n')).match(NOME_USATO) ?? []);

/**
 * I nomi che una riga del corpo dichiara fuori dalle graffe («var uid = 0; function useId…»): quelli dentro una funzione sono
 * suoi. Una dichiarazione di più nomi con la virgola, o una riga `var` con una barra e un'altra dichiarazione (un'espressione
 * regolare può avere parentesi che il conto delle graffe sbaglierebbe), ferma lo script.
 */
function dichiaratiIn(riga, numero) {
    if (!/^ {2}(?:var|function) /.test(riga)) return [];
    const pulita = senzaTestiNeCommenti(riga);
    const dichiarati = [];
    let profondita = 0;
    for (let qui = 2; qui < pulita.length; qui++) {
        const carattere = pulita[qui];
        if ('{(['.includes(carattere)) profondita++;
        else if ('})]'.includes(carattere)) profondita--;
        else if (profondita === 0 && carattere === ',' && /^ {2}var /.test(riga)) vuole(false, `la riga ${numero} dichiara più nomi con la virgola: lo script legge un nome per dichiarazione`);
        else if (profondita === 0 && /[\s;]/.test(pulita[qui - 1] ?? ' ')) {
            const trovato = DICHIARAZIONE.exec(pulita.slice(qui));
            if (trovato) dichiarati.push(trovato[1]);
        }
    }
    // Una riga `var` con una barra (un'espressione regolare) e un'altra dichiarazione dopo un `;`: il conto delle graffe potrebbe
    // non vederla, e si conta sul testo. Nel corpo di una `function` le dichiarazioni sono sue.
    vuole(!/^ {2}var /.test(riga) || !pulita.includes('/') || !/;\s*(?:var|function) /.test(pulita), `la riga ${numero} ha una barra e più di una dichiarazione: lo script non sa dire con certezza quali nomi dichiara`);

    return dichiarati;
}

/**
 * Il testo del modulo di `nome` (una chiave di `A_PARTE`) dal corpo e dai nomi che dà `leggi`. Se una cosa non è come lo script
 * la conosce — il blocco, una forma di riga, una riga privata che non è nell'elenco — lancia un errore che dice quale.
 */
export function aParte({ corpo, nomi }, nome) {
    const numero = (indice) => indice + 4;
    corpo.forEach((riga, indice) => {
        vuole(!/^ {2}\S/.test(riga) || FORME.some((forma) => forma.test(riga)), `la riga ${numero(indice)} («${riga.trim().slice(0, 60)}») ha una forma che lo script non conosce`);
    });

    const inizi = corpo.flatMap((riga, indice) => (riga.startsWith(INIZIO_DEL_BLOCCO(nome)) ? [indice] : []));
    vuole(inizi.length === 1, `il commento «${INIZIO_DEL_BLOCCO(nome).trim()} …», da cui comincia il blocco di ${nome}, c'è ${inizi.length} volte`);
    const funzione = corpo.indexOf(`  function ${nome}(p) {`, inizi[0]);
    vuole(funzione > inizi[0], `dopo il commento del blocco di ${nome} non c'è la riga «function ${nome}(p) {»`);
    const fine = corpo.findIndex((riga, indice) => indice > funzione && /^ {2}\S/.test(riga));
    vuole(fine > funzione && corpo[fine] === '  }', `la funzione ${nome} non si chiude con una riga «}» (riga ${numero(fine)})`);
    const blocco = corpo.slice(inizi[0], fine + 1);
    const delBlocco = new Set(blocco.flatMap((riga, indice) => dichiaratiIn(riga, numero(inizi[0] + indice))));

    // Dove sta ogni dichiarazione del corpo fuori dal blocco: un nome usato che è lì si porta con la sua riga, o si importa.
    const rigaDi = new Map();
    corpo.forEach((riga, indice) => {
        if (indice < inizi[0] || indice > fine) dichiaratiIn(riga, numero(indice)).forEach((dichiarato) => rigaDi.set(dichiarato, indice));
        const assegnato = FORME[4].exec(riga)?.[1];
        vuole(assegnato === undefined || !delBlocco.has(assegnato), `la riga ${numero(indice)} dà una proprietà a ${assegnato}, che è del blocco di ${nome}: lo script non la porta nel modulo`);
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
        vuole(A_PARTE[nome].includes(corpo[indice]), `${nome} usa «${usato}», dichiarato alla riga ${numero(indice)} del bundle, e la riga non è fra le righe private che lo script porta nel suo modulo (A_PARTE): va guardata, e l'elenco riallineato`);
        righePrivate.add(indice);
        daGuardare.push(...nomiUsati([corpo[indice]]));
    }
    const portate = [...righePrivate].map((indice) => corpo[indice]);
    const mancanti = A_PARTE[nome].filter((riga) => !portate.includes(riga));
    vuole(mancanti.length === 0, `la riga privata «${mancanti[0]?.trim().slice(0, 60)}» dell'elenco di ${nome} (A_PARTE) non c'è più nel bundle, o ${nome} non la usa più: l'elenco va riallineato`);

    // Le righe private e il blocco, nell'ordine del bundle: una riga privata che sta dopo il blocco resta dopo.
    const righe = [...righePrivate, ...blocco.map((_riga, indice) => inizi[0] + indice)].sort((a, b) => a - b);

    return [
        `// Generato da scripts/componenti.mjs: non si ritocca a mano. È ${nome} di resources/zeiras/bundle.js (il design system di`,
        '// Zeiras, copia derivata) in un modulo suo: il suo blocco del bundle e le righe private che usa, riga per riga; i componenti che',
        '// usa li prende da ./componenti. A un riallineamento si rigenera con `npm run componenti`.',
        "import * as React from 'react';",
        ...(daImportare.size > 0 ? [`import { ${[...daImportare].sort().join(', ')} } from './componenti';`] : []),
        ...righe.map((indice, posto) => (posto > 0 && indice === inizi[0] ? ['', corpo[indice]] : [corpo[indice]])).flat(),
        '',
        `export { ${nome} };`,
        '',
    ].join('\n');
}
