// I moduli ES di resources/js/zeiras dal testo di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata): gli
// stessi componenti, un modulo per ogni nome che il bundle registra, e `componenti.js` che li esporta per nome. Il bundle è una
// funzione che legge `window.React` e scrive tutto in `window.Zeiras`: chi lo importa li porta tutti nella build. I moduli
// importano React da sé, e la build di un frontend tiene solo quelli che l'app usa, ognuno nel pezzo che lo usa. Il corpo non si
// riscrive: è quello del bundle riga per riga (tranne tre righe segnate pure, sotto), senza le prime tre (il commento del formato,
// l'apertura della funzione, `var React = window.React;`) e senza la registrazione in `window.Zeiras` in fondo, al cui posto vanno
// gli `export`; come si divide fra i moduli lo dice `moduli`. Qui si conosce una forma sola del bundle, e la si controlla prima di
// comporre: se una cosa non torna un errore dice quale. Questo file lavora solo su testi, senza `node:fs`: lo importano il comando
// (scripts/componenti.mjs, che legge e scrive i file) e i casi di vitest, che i file li prendono come testo (`?raw`).

import { parseAst } from 'vite';

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

// I componenti coi loro stili in resources/css/zeiras/<Nome>.css (dalla `v3.3.0`, sprint 75, voce 2570): il modulo che usa le loro
// classi li importa, e un'app che li prende solo in una pagina a richiesta non li porta nel CSS del primo carico. Gli stili degli
// altri restano in resources/css/zeiras.css (quelli dell'Alert anche: servono al Toast della cornice, #3055).
export const STILI_A_PARTE = ['MentionField', 'AddressField'];

const INIZIO_DEL_BLOCCO = (nome) => `  /* ---------- ${nome}: `;

// Dalla `v3.3.0` (sprint 75, voce 2570): gli stili di ogni componente di `STILI_A_PARTE` escono anche da resources/zeiras/bundle.css,
// così un'app che li prende dai loro moduli a richiesta non li porta nel CSS del primo carico. Nel bundle gli stili di un
// componente cominciano con una riga «/* <Nome>» (seguita da uno spazio, dai due punti o dalla chiusura del commento) e finiscono
// prima della riga che comincia il commento seguente, o a fine file.
const INIZIO_DEGLI_STILI = (nome) => new RegExp(`^/\\* ${nome}(?:[ :]|\\*/)`);
const CLASSE = /\.(zr-[\w-]+)/g;
const classiIn = (righe) => [...new Set([...righe.join('\n').matchAll(CLASSE)].map((trovata) => trovata[1]))];
const GENERATO_DAL_CSS = (cheCosa) => `/* Generato da scripts/componenti.mjs: non si ritocca a mano. ${cheCosa} A un riallineamento si rigenera con \`npm run componenti\`. */`;

// Dalla `v3.15.0` (sprint 92, voce #2945, Decisione 19881 di zr-pm): i due font del design system arrivano dal pacchetto
// (resources/fonts, con le regole in resources/css/font.css) e non da Google Fonts, che riceverebbe l'IP di ogni visita. Nei CSS
// generati la riga dell'`@import` di Google diventa quella di font.css, che sta nella stessa cartella. Il bundle che chiede a
// Google altri font (un'altra famiglia, un altro peso, un secondo `@import`, un file da fonts.gstatic.com) ferma lo script:
// resources/fonts e font.css vanno riallineati prima. Un bundle senza Google prende i font del pacchetto in testa.
const IMPORT_DEI_FONT = "@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400..700&display=swap');";
const FONT_DEL_PACCHETTO = "@import './font.css';";

/** Il CSS del bundle coi font del pacchetto: la riga dell'`@import` di Google sostituita da quella di font.css. */
export function coiFontDelPacchetto(css) {
    const righe = css.split('\n');
    const diGoogle = righe.flatMap((riga, indice) => (/fonts\.(googleapis|gstatic)\.com/.test(riga) ? [indice] : []));
    if (diGoogle.length === 0) return [FONT_DEL_PACCHETTO, ...righe].join('\n');
    vuole(diGoogle.length === 1 && righe[diGoogle[0]] === IMPORT_DEI_FONT && righe.slice(0, diGoogle[0]).every((riga) => riga.trim() === ''), `bundle.css nomina Google Fonts in una forma che il pacchetto non sostituisce: «${righe[diGoogle.at(-1)].slice(0, 120)}»; se i font sono cambiati si riallineano resources/fonts e resources/css/font.css, se è cambiata solo la forma (un'altra riga, un commento prima, CRLF) lo script`);
    righe[diGoogle[0]] = FONT_DEL_PACCHETTO;

    return righe.join('\n');
}

// Voce #3534 (Decisione 23090 di zr-pm-07): sotto i font, l'`@import` di movimento.css, la regola del pacchetto che spegne le
// transizioni per chi chiede meno movimento. È un file scritto a mano: nei CSS generati c'è solo la riga che lo importa.
const MOVIMENTO_DEL_PACCHETTO = "@import './movimento.css';";

/** Il CSS del bundle coi file del pacchetto: i font al posto di Google e, nella riga sotto, movimento.css. */
export function coiCssDelPacchetto(css) {
    const righe = coiFontDelPacchetto(css).split('\n');
    righe.splice(righe.indexOf(FONT_DEL_PACCHETTO) + 1, 0, MOVIMENTO_DEL_PACCHETTO);

    return righe.join('\n');
}

/** resources/css/bundle.css: il bundle intero, con gli stili di tutti i componenti, i font del pacchetto e movimento.css. */
export function bundleIntero(css) {
    return [GENERATO_DAL_CSS('È resources/zeiras/bundle.css (il design system di Zeiras, copia derivata) coi font del pacchetto (resources/css/font.css) al posto di Google Fonts, e la regola del pacchetto per chi chiede meno movimento (resources/css/movimento.css).'), coiCssDelPacchetto(css)].join('\n');
}

/**
 * Il bundle CSS diviso: `zeiras` (resources/css/zeiras.css) è il bundle senza gli stili dei componenti di `STILI_A_PARTE`, le altre
 * righe com'erano e nel loro ordine; `stili[nome]` (resources/css/zeiras/<Nome>.css) sono quelli di un componente; `proprie[nome]`
 * le classi che solo i suoi stili definiscono (una classe che sta negli stili di due componenti è del primo dei due). Se gli stili
 * di un componente non ci sono, ci sono due volte o non hanno una classe loro, lancia un errore.
 */
export function dividiIlCss(css) {
    const righe = coiCssDelPacchetto(css).split('\n');
    const tolte = new Set();
    const blocchi = {};
    for (const nome of STILI_A_PARTE) {
        const inizi = righe.flatMap((riga, indice) => (INIZIO_DEGLI_STILI(nome).test(riga) ? [indice] : []));
        vuole(inizi.length === 1, `il commento «/* ${nome} …», che segna gli stili di ${nome} in bundle.css, c'è ${inizi.length} volte`);
        const [inizio] = inizi;
        const seguente = righe.findIndex((riga, indice) => indice > inizio && riga.startsWith('/* '));
        let fine = seguente === -1 ? righe.length : seguente;
        while (fine > inizio + 1 && righe[fine - 1].trim() === '') fine -= 1;
        for (let indice = inizio; indice < fine; indice += 1) tolte.add(indice);
        // La riga vuota che separa gli stili da ciò che sta sopra va via con loro.
        if (inizio > 0 && righe[inizio - 1].trim() === '') tolte.add(inizio - 1);
        blocchi[nome] = righe.slice(inizio, fine);
    }
    const resto = righe.filter((_riga, indice) => !tolte.has(indice));
    // Il prefisso delle classi di un blocco (`zr-mention` da `.zr-mention-anchor`) fuori dal blocco vuol dire un blocco spezzato:
    // un commento in mezzo agli stili del componente, e il resto dei suoi stili lasciato in zeiras.css.
    // Il prefisso viene dalla prima classe del blocco che il resto non ha (revisione della PR #134, seconda lettura).
    const delResto = new Set(classiIn(resto));
    for (const nome of STILI_A_PARTE) {
        const sua = classiIn(blocchi[nome]).find((classe) => !delResto.has(classe) && /^zr-[a-z]+/.test(classe));
        vuole(sua !== undefined, `gli stili di ${nome} in bundle.css non hanno una classe loro`);
        const [prefisso] = /^zr-[a-z]+/.exec(sua);
        const fuori = resto.filter((riga) => new RegExp(`\\.${prefisso}(?![a-z])`).test(riga));
        vuole(fuori.length === 0, `in bundle.css ${fuori.length} righe con le classi .${prefisso} stanno fuori dagli stili di ${nome}, dopo un commento: «${fuori[0]?.slice(0, 60)}»`);
    }
    const prese = new Set(classiIn(resto));
    const proprie = {};
    for (const nome of [...STILI_A_PARTE].sort((a, b) => righe.indexOf(blocchi[a][0]) - righe.indexOf(blocchi[b][0]))) {
        proprie[nome] = classiIn(blocchi[nome]).filter((classe) => !prese.has(classe));
        vuole(proprie[nome].length > 0, `gli stili di ${nome} in bundle.css non hanno una classe loro`);
        proprie[nome].forEach((classe) => prese.add(classe));
    }
    const nomi = STILI_A_PARTE;

    return {
        zeiras: [GENERATO_DAL_CSS(`È resources/zeiras/bundle.css (il design system di Zeiras, copia derivata) senza gli stili di ${nomi.join(' e di ')}, che stanno in resources/css/zeiras/ e arrivano col loro modulo, coi font del pacchetto (resources/css/font.css) al posto di Google Fonts, e la regola del pacchetto per chi chiede meno movimento (resources/css/movimento.css).`), ...resto].join('\n'),
        stili: Object.fromEntries(nomi.map((nome) => [nome, [GENERATO_DAL_CSS(`Sono gli stili di ${nome} di resources/zeiras/bundle.css (il design system di Zeiras, copia derivata): li importa il modulo resources/js/zeiras/${nome}.js.`), ...blocchi[nome], ''].join('\n')])),
        proprie,
    };
}

/** I componenti di `STILI_A_PARTE` di cui queste righe usano una classe propria (come nome intero), nell'ordine dell'elenco. */
function stiliUsati(righe, { proprie }) {
    const testo = righe.join('\n');

    return STILI_A_PARTE.filter((altro) => proprie[altro].some((classe) => new RegExp(`(?<![\\w-])${classe}(?![\\w-])`).test(testo)));
}

// Dalla `v4.30.0` (voce #3511): un modulo per ogni nome che il bundle registra, resources/js/zeiras/<Nome>.js, e `componenti.js`
// che li ri-esporta soltanto. Prima `componenti.js` era un modulo solo: una pagina a richiesta che ne prendeva un componente
// lasciava nel pezzo dell'ingresso, che importa lo stesso modulo, il codice di quel componente. Con un modulo per nome la build
// di un frontend mette ogni componente nel pezzo che lo usa. Il corpo del bundle si divide in istruzioni (quelle che stanno su
// una riga in comune vanno insieme: «var uid = 0; function useId…»), ognuna col testo che le sta sopra, commenti compresi, e va
// in un posto solo: un'istruzione non si copia mai, così uno stato (il contatore degli id, un contesto, una cache) c'è una volta.
// Il posto lo dice chi la usa: la dichiarazione di un nome registrato sta nel suo modulo; una riga privata che serve a un nome
// registrato solo (anche attraverso altre righe) sta nel suo modulo; una che serve a più nomi sta in resources/js/zeiras/interni/,
// insieme alle altre che servono agli stessi nomi, in un modulo che prende il nome della prima. `Avatar.Stack = AvatarStack;` sta
// col nome a cui dà la proprietà. Ogni altra istruzione senza dichiarazione ferma lo script. Un modulo importa da un altro i nomi
// che usa; se un modulo legge appena caricato un nome di un altro che a sua volta lo importa (un giro), lo script si ferma: in un
// giro il nome letto subito può non esserci ancora. Le righe le legge il parser della build (`parseAst` di Vite).
const COMMENTO_GENERATO = (...cheCosa) => ['// Generato da scripts/componenti.mjs: non si ritocca a mano.', ...cheCosa.map((riga) => `// ${riga}`), '// A un riallineamento si rigenera con `npm run componenti`.'];

/** I nomi che un'istruzione dichiara, o `null` se non ne dichiara. Una dichiarazione che non è di nomi semplici ferma lo script. */
function dichiaratiDa(istruzione, numero) {
    if (istruzione.type === 'FunctionDeclaration' || istruzione.type === 'ClassDeclaration') return [istruzione.id.name];
    if (istruzione.type !== 'VariableDeclaration') return null;

    return istruzione.declarations.map((dichiarazione) => {
        vuole(dichiarazione.id.type === 'Identifier', `la riga ${numero} dichiara i nomi in una forma che lo script non legge (${dichiarazione.id.type})`);

        return dichiarazione.id.name;
    });
}

/** I nomi che un modello di assegnazione lega (`a`, `{ a, b: c }`, `[a, ...b]`, `a = 1`). */
function legatiDa(modello, nomi = []) {
    if (modello === null) return nomi;
    if (modello.type === 'Identifier') nomi.push(modello.name);
    else if (modello.type === 'AssignmentPattern') legatiDa(modello.left, nomi);
    else if (modello.type === 'RestElement') legatiDa(modello.argument, nomi);
    else if (modello.type === 'ArrayPattern') modello.elements.forEach((elemento) => legatiDa(elemento, nomi));
    else if (modello.type === 'ObjectPattern') modello.properties.forEach((proprieta) => legatiDa(proprieta.type === 'RestElement' ? proprieta : proprieta.value, nomi));

    return nomi;
}

/** I nomi che una funzione ha suoi: il suo nome, i parametri, e ciò che dichiara dentro (fuori dalle funzioni che ha dentro). */
function localiDi(funzione) {
    const nomi = [...(funzione.id ? [funzione.id.name] : []), ...funzione.params.flatMap((parametro) => legatiDa(parametro))];
    const cerca = (nodo) => {
        if (nodo === null || typeof nodo !== 'object') return;
        if (Array.isArray(nodo)) {
            nodo.forEach(cerca);

            return;
        }
        if (nodo.type === 'VariableDeclarator') legatiDa(nodo.id, nomi);
        if ((nodo.type === 'FunctionDeclaration' || nodo.type === 'ClassDeclaration') && nodo.id) nomi.push(nodo.id.name);
        if (/Function/.test(nodo.type)) return;
        for (const chiave of Object.keys(nodo)) if (!['type', 'start', 'end', 'range', 'loc'].includes(chiave)) cerca(nodo[chiave]);
    };
    cerca(funzione.body);

    return new Set(nomi);
}

/**
 * I nomi che un nodo usa (`usati`), quelli che legge appena il modulo si carica (`subito`: fuori da una funzione, o in una
 * funzione passata a una chiamata fatta lì, come il `.map` dei dati di esempio), fra questi quelli che chiama (`chiamati`), e
 * quelli a cui dà un valore (`assegnati`: `uid += 1` di AppShell), fuori dai nomi che una funzione ha suoi. Una proprietà
 * (`a.b`, `{ b: … }`) non è un nome.
 */
function nomiIn(nodo, letti, inFunzione = false, funzioniSubito = false, locali = new Set()) {
    if (nodo === null || typeof nodo !== 'object') return;
    if (Array.isArray(nodo)) {
        nodo.forEach((uno) => nomiIn(uno, letti, inFunzione, funzioniSubito, locali));

        return;
    }
    if (nodo.type === 'Identifier') {
        letti.usati.add(nodo.name);
        if (!inFunzione) letti.subito.add(nodo.name);

        return;
    }
    if (nodo.type === 'MemberExpression' && !nodo.computed) {
        nomiIn(nodo.object, letti, inFunzione, false, locali);

        return;
    }
    if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(nodo.type) && !nodo.computed && !nodo.shorthand) {
        nomiIn(nodo.value, letti, inFunzione, funzioniSubito, locali);

        return;
    }
    const assegnato = nodo.type === 'AssignmentExpression' ? nodo.left : nodo.type === 'UpdateExpression' ? nodo.argument : null;
    if (assegnato?.type === 'Identifier' && !locali.has(assegnato.name)) letti.assegnati.add(assegnato.name);
    if ((nodo.type === 'CallExpression' || nodo.type === 'NewExpression') && !inFunzione) {
        if (nodo.callee.type === 'Identifier') letti.chiamati.add(nodo.callee.name);
        nomiIn(nodo.callee, letti, false, true, locali);
        nomiIn(nodo.arguments, letti, false, true, locali);

        return;
    }
    const funzione = /Function/.test(nodo.type);
    const dentro = funzione ? new Set([...locali, ...localiDi(nodo)]) : locali;
    for (const chiave of Object.keys(nodo)) {
        if (!['type', 'start', 'end', 'range', 'loc'].includes(chiave)) nomiIn(nodo[chiave], letti, inFunzione || (funzione && !funzioniSubito), false, dentro);
    }
}

/**
 * Le istruzioni del corpo, quelle su una riga in comune insieme: per ognuna il testo (con ciò che le sta sopra), il numero della
 * riga del bundle, i nomi che dichiara, quelli che usa, legge subito e chiama, e il nome a cui dà una proprietà (`Avatar.Stack`).
 */
function istruzioni(corpo) {
    const testo = corpo.join('\n');
    let albero;
    try {
        albero = parseAst(testo);
    } catch (errore) {
        vuole(false, `il corpo non si legge come JavaScript (${errore.message.split('\n')[0]})`);
    }
    const rigaDi = (posto) => testo.slice(0, posto).split('\n').length - 1;
    const unita = [];
    for (const istruzione of albero.body) {
        const prima = rigaDi(istruzione.start), ultima = rigaDi(istruzione.end);
        const numero = prima + 4;
        const dichiarati = dichiaratiDa(istruzione, numero);
        let proprietaDi = null;
        if (dichiarati === null) {
            const assegnazione = istruzione.type === 'ExpressionStatement' ? istruzione.expression : null;
            proprietaDi = assegnazione?.type === 'AssignmentExpression' && assegnazione.left.type === 'MemberExpression' && !assegnazione.left.computed && assegnazione.left.object.type === 'Identifier' ? assegnazione.left.object.name : null;
            vuole(proprietaDi !== null, `la riga ${numero} («${testo.slice(istruzione.start, Math.min(istruzione.end, istruzione.start + 60)).split('\n')[0]}») non dichiara un nome né dà una proprietà a un nome: lo script non sa in quale modulo metterla`);
        }
        const letti = { usati: new Set(), subito: new Set(), chiamati: new Set(), assegnati: new Set() };
        nomiIn(istruzione, letti);
        const sullaStessaRiga = unita.at(-1)?.ultima === prima ? unita.at(-1) : null;
        if (sullaStessaRiga !== null) {
            sullaStessaRiga.ultima = ultima;
            sullaStessaRiga.dichiarati.push(...(dichiarati ?? []));
            vuole(proprietaDi === null && sullaStessaRiga.proprietaDi === null, `la riga ${numero} dà una proprietà a un nome sulla riga di un'altra istruzione: lo script non sa in quale modulo metterla`);
            for (const chiave of ['usati', 'subito', 'chiamati', 'assegnati']) letti[chiave].forEach((nome) => sullaStessaRiga[chiave].add(nome));
            continue;
        }
        unita.push({ prima, ultima, numero, dichiarati: dichiarati ?? [], proprietaDi, dichiarazione: istruzione.type, ...letti });
    }
    // Il testo di un'istruzione va dalla riga dopo quella che chiude la precedente alla riga che la chiude: i commenti sopra sono suoi.
    unita.forEach((una, indice) => {
        una.testo = corpo.slice(indice === 0 ? 0 : unita[indice - 1].ultima + 1, una.ultima + 1);
        while (una.testo.length > 1 && una.testo[0].trim() === '') una.testo = una.testo.slice(1);
    });

    return unita;
}

/** Il nome del file di un modulo, da resources/js/zeiras. */
const fileDi = (modulo) => (modulo.interno ? `interni/${modulo.nome}.js` : `${modulo.nome}.js`);
/** Il percorso con cui il modulo `da` importa il modulo `a`. */
function percorso(da, a) {
    if (da.interno === a.interno) return `./${a.nome}`;

    return da.interno ? `../${a.nome}` : `./interni/${a.nome}`;
}

/**
 * I moduli dei componenti: per ogni file, da resources/js/zeiras (`componenti.js`, `<Nome>.js`, `interni/<nome>.js`), il suo testo.
 * Con `divisi` (da `dividiIlCss`) un modulo che usa le classi proprie di un componente di `STILI_A_PARTE` ne importa gli stili.
 * Se una cosa non è come lo script la conosce lancia un errore che dice quale.
 */
export function moduli({ corpo, nomi }, divisi = undefined) {
    const unita = istruzioni(corpo);
    const dove = new Map();
    unita.forEach((una, indice) => una.dichiarati.forEach((nome) => {
        vuole(!dove.has(nome), `«${nome}» è dichiarato due volte (righe ${unita[dove.get(nome) ?? 0]?.numero} e ${una.numero})`);
        dove.set(nome, indice);
    }));
    // Certe istruzioni stanno nello stesso modulo di un'altra, e chi usa l'una usa anche l'altra: quella che dà una proprietà a un
    // nome sta con lui, e quella che dà un valore a un nome dichiarato altrove (`uid += 1` di AppShell) sta con la sua dichiarazione,
    // perché in un modulo ES un nome importato non si assegna. Il gruppo ha il modulo del nome registrato che contiene.
    const capo = unita.map((_una, indice) => indice);
    const radice = (indice) => (capo[indice] === indice ? indice : (capo[indice] = radice(capo[indice])));
    const unisci = (a, b) => {
        capo[radice(a)] = radice(b);
    };
    unita.forEach((una, indice) => {
        if (una.proprietaDi !== null) {
            vuole(dove.has(una.proprietaDi), `la riga ${una.numero} dà una proprietà a «${una.proprietaDi}», che il corpo del bundle non dichiara`);
            unisci(indice, dove.get(una.proprietaDi));
        }
        for (const nome of una.assegnati) if (dove.has(nome) && dove.get(nome) !== indice) unisci(indice, dove.get(nome));
    });
    const registratiIn = (indice) => unita[indice].dichiarati.filter((nome) => nomi.includes(nome));
    const perGruppo = new Map();
    unita.forEach((_una, indice) => {
        const gruppo = radice(indice);
        const scelto = perGruppo.get(gruppo);
        if (scelto === undefined || (registratiIn(scelto).length === 0 && registratiIn(indice).length > 0)) perGruppo.set(gruppo, indice);
        else vuole(registratiIn(indice).length === 0 || registratiIn(scelto).length === 0, `le righe ${unita[scelto].numero} e ${unita[indice].numero} dichiarano due nomi registrati e devono stare nello stesso modulo (una dà un valore o una proprietà a un nome dell'altra): lo script dà un modulo a ognuno`);
    });
    const conChi = unita.map((_una, indice) => perGruppo.get(radice(indice)));
    const dipende = unita.map(() => new Set());
    unita.forEach((una, indice) => {
        for (const nome of una.usati) if (dove.has(nome) && conChi[dove.get(nome)] !== conChi[indice]) dipende[conChi[indice]].add(conChi[dove.get(nome)]);
    });

    // Per ogni istruzione, i nomi registrati che la raggiungono.
    const diChi = unita.map(() => new Set());
    for (const nome of nomi) {
        vuole(dove.has(nome), `il bundle registra «${nome}», che il corpo non dichiara`);
        const visti = new Set();
        const daVedere = [dove.get(nome)];
        while (daVedere.length > 0) {
            const indice = daVedere.pop();
            if (visti.has(indice)) continue;
            visti.add(indice);
            diChi[indice].add(nome);
            daVedere.push(...dipende[indice]);
        }
    }
    // Il modulo di ogni istruzione.
    const perNome = new Map();
    const interni = new Map();
    const modulo = unita.map((una, indice) => {
        const registrati = una.dichiarati.filter((nome) => nomi.includes(nome));
        vuole(registrati.length <= 1, `la riga ${una.numero} dichiara più nomi registrati (${registrati.join(', ')}): lo script dà un modulo a ognuno`);
        if (conChi[indice] !== indice) return null;
        if (registrati.length === 1) {
            const suo = { nome: registrati[0], interno: false, unita: [] };
            perNome.set(registrati[0], suo);

            return suo;
        }
        if (diChi[indice].size === 1) return [...diChi[indice]][0];
        const chiave = [...diChi[indice]].sort().join(',');
        const primo = unita.flatMap((altra, quale) => (conChi[quale] === indice ? altra.dichiarati : []))[0];
        if (!interni.has(chiave)) interni.set(chiave, { nome: primo, interno: true, unita: [] });

        return interni.get(chiave);
    });
    const moduloDi = (indice) => {
        const suo = modulo[conChi[indice]];

        return typeof suo === 'string' ? perNome.get(suo) : suo;
    };
    unita.forEach((_una, indice) => moduloDi(indice).unita.push(indice));
    const tutti = [...perNome.values(), ...interni.values()];
    const nomiDeiFile = new Map();
    for (const uno of tutti) {
        const chiave = fileDi(uno).toLowerCase();
        vuole(!nomiDeiFile.has(chiave) && !['componenti.js', 'index.js'].includes(chiave), `due moduli avrebbero lo stesso file, ${fileDi(uno)}`);
        nomiDeiFile.set(chiave, uno);
    }

    // Gli import: per ogni modulo, i nomi che usa e che stanno in un altro.
    const importa = new Map(tutti.map((uno) => [uno, new Map()]));
    const esporta = new Map(tutti.map((uno) => [uno, new Set(uno.interno ? [] : [uno.nome])]));
    for (const uno of tutti) {
        for (const indice of uno.unita) {
            for (const nome of unita[indice].usati) {
                if (!dove.has(nome)) continue;
                const altro = moduloDi(dove.get(nome));
                if (altro === uno) continue;
                if (!importa.get(uno).has(altro)) importa.get(uno).set(altro, new Set());
                importa.get(uno).get(altro).add(nome);
                esporta.get(altro).add(nome);
            }
        }
    }
    // Un nome letto subito da un altro modulo (una `var`, o una funzione chiamata lì per lì) non può stare in un giro.
    const raggiunge = (da, a, visti = new Set()) => {
        if (da === a) return true;
        if (visti.has(da)) return false;
        visti.add(da);

        return [...importa.get(da).keys()].some((altro) => raggiunge(altro, a, visti));
    };
    for (const uno of tutti) {
        for (const indice of uno.unita) {
            for (const nome of unita[indice].subito) {
                if (!dove.has(nome) || moduloDi(dove.get(nome)) === uno) continue;
                const altro = moduloDi(dove.get(nome));
                const funzione = unita[dove.get(nome)].dichiarazione === 'FunctionDeclaration';
                vuole((funzione && !unita[indice].chiamati.has(nome)) || !raggiunge(altro, uno), `la riga ${unita[indice].numero} legge subito «${nome}» di ${fileDi(altro)}, che importa ${fileDi(uno)}: in un giro il nome può non esserci ancora`);
            }
        }
    }

    const file = {};
    file['componenti.js'] = [
        ...COMMENTO_GENERATO(
            'Sono i nomi che resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) registra, ognuno dal suo modulo',
            '(resources/js/zeiras/<Nome>.js): la build di un frontend mette ogni componente nel pezzo che lo usa.',
        ),
        // Nell'ordine in cui il bundle li dichiara, non in quello della registrazione: la build mette i moduli nell'ordine in cui li
        // incontra, e un'app che li prende tutti (l'ingresso di sempre) resta, con gzip, quasi quanto il bundle (+96 byte, non +993).
        ...[...nomi].sort((a, b) => dove.get(a) - dove.get(b)).map((nome) => `export { ${nome} } from './${nome}';`),
        '',
    ].join('\n');
    for (const uno of tutti) {
        const righe = uno.unita.sort((a, b) => a - b).flatMap((indice) => unita[indice].testo);
        const usaReact = uno.unita.some((indice) => unita[indice].usati.has('React') && !dove.has('React'));
        const stili = divisi === undefined ? [] : stiliUsati(righe, divisi);
        const quanti = new Set(uno.unita.flatMap((indice) => [...diChi[conChi[indice]]])).size;
        file[fileDi(uno)] = [
            ...(uno.interno
                ? COMMENTO_GENERATO(
                    'Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono',
                    `a ${quanti === 0 ? 'nessun nome registrato' : `${quanti} nomi registrati`}: stanno qui una volta sola e chi le usa le importa.`,
                )
                : COMMENTO_GENERATO(
                    `È ${uno.nome} di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue`,
                    'righe del bundle e quelle private che usa lui solo; il resto lo importa.',
                    ...(esporta.get(uno).size > 1
                        ? [`Qui stanno anche ${[...esporta.get(uno)].filter((nome) => nome !== uno.nome).sort().join(', ')}, che altri moduli importano da qui: ${uno.nome}`, 'dà un valore a un nome delle loro righe, e in un modulo ES un nome importato non si assegna.']
                        : []),
                )),
            ...(usaReact ? ["import * as React from 'react';"] : []),
            // Gli import nell'ordine del bundle (dalla prima riga di ogni modulo): la build mette i moduli nell'ordine in cui li
            // incontra, e il codice resta vicino a quello che nel bundle gli sta accanto, che con gzip pesa meno.
            ...[...importa.get(uno)].sort(([a], [b]) => Math.min(...a.unita) - Math.min(...b.unita)).map(([altro, usati]) => `import { ${[...usati].sort().join(', ')} } from '${percorso(uno, altro)}';`),
            ...stili.map((altro) => `import '${uno.interno ? '../' : ''}../../css/zeiras/${altro}.css';`),
            '',
            ...righe,
            ...(esporta.get(uno).size > 0 ? ['', `export { ${[...esporta.get(uno)].sort().join(', ')} };`] : []),
            '',
        ].join('\n');
    }

    return file;
}

/** I file dei moduli dei componenti per questo bundle (vedi `moduli`), senza gli import degli stili. */
export function genera(bundle) {
    return moduli(leggi(bundle));
}
