// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import generato from './zeiras/componenti.js?raw';

// Sprint 25 · T2 (voce #1759). L'ingresso per le app, `resources/js/app.ts`: la cornice senza `Zeiras`, cioè senza i componenti
// del design system che l'app non usa. Qui si costruiscono le tre app di prova di resources/demo/peso come le costruisce un
// frontend — minificate, React fuori — e i due ingressi come li costruisce `npm run build`, e si guarda il JS che esce: il suo
// testo e il suo peso con gzip. Il caso gira in node: costruisce con Vite, e un DOM non gli serve. I pesi che il README dice
// sono quelli misurati qui.

const FUORI = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

// Un testo per ognuno di tre componenti che la cornice non usa: una domanda della pagina pubblica (`FAQ`), il logo del sito
// (`SiteHeader`), l'intestazione di una colonna (`KanbanColumn`). Poi la tabella (`DataTable`), che entra solo in un'app che la
// usa, e l'`AppShell`, che è la cornice.
const DI_ALTRI = ['Qual è il trucco?', 'zr-site-logo', 'zr-col-head'];
const DELLA_TABELLA = 'zr-table';
const DEL_PULSANTE = 'zr-btn';
const DELLA_CORNICE = 'zr-shell';

// Il design system intero in un'app, in due modi: com'era fino al tag v1.14.0, dal bundle (resources/zeiras/bundle.js, che
// legge `window.React` e scrive `window.Zeiras`), e com'è ora, dal modulo che ne esce (resources/js/zeiras/index.ts). Sono i
// testi di due ingressi senza un file: si costruiscono qui, uno accanto all'altro, con gli stessi strumenti, e si confrontano
// fra loro. Mai con un numero scritto a mano: sarebbe un tetto sulla cornice che cresce, e cambierebbe con gli strumenti.
const DAL_BUNDLE = ['resources/js/zeiras/react-globale.ts', 'resources/zeiras/bundle.js'];
const DAL_MODULO = ['resources/js/zeiras/index.ts'];
const MEZZO_KB = 512;

// Sprint 30 · T1 (voce #1875). Le frasi delle notifiche non stanno più nel JS d'ingresso: la cornice le chiede con `fetch` quando
// si apre la campanella, un file `.json` per lingua. Una frase per lingua, com'è scritta nel suo file: la stessa notifica, la cartella creata.
const FRASI = { it: 'ha creato l\'area', en: 'created the area', es: 'ha creado el área' };
/**
 * Il tetto sul JS d'ingresso dell'app che prende solo la cornice, con gzip: prima dello sprint 30 pesava 18,8 KB. Il refining
 * diceva 17,5: la misura è 17,9, perché con il primo `import()` di un'app Vite mette nel JS d'ingresso il suo aiuto per i pezzi
 * a richiesta (circa 0,7 KB con gzip, da solo), che un'app con le pagine a richiesta ha già. Il tetto è la misura, a 18.
 * Con le difese dei due nomi (T2) la misura è 18,0: il tetto resta dov'è (decisione di zr-pm del 12/10/2026), e ciò che non
 * ci sta non entra nel JS d'ingresso.
 *
 * Una sola eccezione, di 32 byte (zr-pm, 12/10/2026, nota 11697 del progetto): i rimedi provvisori di tastiera, voci #1871
 * (il fuoco nel pannello delle notifiche) e #1870 (Tab dentro un dialogo aperto). Stanno in un pezzo a richiesta, e nel JS
 * d'ingresso c'è solo la riga che lo chiede. Il tetto torna a 18 KB quando i rimedi escono, perché il design system porta
 * i suoi, o con la prossima versione maggiore.
 *
 * Sprint 33 · T1 (voce #1915): è la versione maggiore, la `v2.0.0`. Ciò che compone le righe delle notifiche e carica le frasi
 * è uscito dal JS d'ingresso, in un pezzo che la cornice chiede quando si apre la campanella: l'eccezione è finita, e il
 * tetto è di nuovo 18 KB.
 *
 * Sprint 36 · T2 (voce #1968): la cornice si rifà quando cambia la persona, e la correzione non ci sta nemmeno togliendo altro.
 * Il tetto sale di ciò che costa lei, 17 byte, e di nient'altro (zr-pm, 13/10/2026, nota 12283 del progetto, punto 5:
 * l'eccezione vale per questa correzione e per quella di Indietro). Ciò che non ci sta continua a non entrare.
 *
 * Sprint 36 · T3 (voce #1967): con Indietro la cornice non riporta la persona di allora. È la seconda correzione di
 * quell'eccezione, e costa 37 byte: tiene chi ha mostrato per ultimo e ne confronta il segno con quello della pagina.
 *
 * Sprint 37 · T4 (voce #1999): in una scheda ferma la cornice non mostra l'elenco e i risultati di un'altra persona, e ricarica
 * la pagina. Costa 68 byte sul tetto, e non ci sta nemmeno togliendo altro: 22 varianti misurate, da 18.540 a 18.556 (le più
 * leggere tengono l'email fuori da React, o lasciano il pannello in errore fino al ricaricamento). Il tetto sale di quei 68
 * byte per questa sola correzione (zr-pm, 13/10/2026, nota 12503 del progetto). Ciò che non ci sta continua a non entrare.
 *
 * Sprint 42 · T2 e T3 (voce #2054): la ricerca della cornice è uscita dal JS d'ingresso, in un pezzo che la cornice chiede al
 * primo fuoco nel campo. L'ingresso pesa 18.181 byte, e il tetto scende: è quel peso più ciò che costano, misurate sopra
 * quella forma, le quattro correzioni che lo aspettano — Indietro senza il segno della lettura (#1975, 16 byte), l'attesa
 * che finisce dopo la ricarica (#2036, 6), il tetto delle ricariche (#2053, 26) e la lingua del primo disegno (#2052, 0) —,
 * e niente oltre (zr-pm, 13/10/2026, nota 12843 del progetto). È un numero scritto, non il peso di oggi: scende di 325 byte.
 * Sprint 42 · T4: la prima delle quattro è entrata, coi suoi 16 byte (ingresso 18.197).
 *
 * Sprint 50 · T5.4 (voce #2056): i dati di esempio e i formattatori dei numeri del design system sono usciti dal JS d'ingresso
 * (T1, voce #2073), e il tetto scende a ciò che l'ingresso pesa a fine sprint, con le correzioni di T3, T4 e T5 dentro: 17.789
 * byte, 440 meno di prima, senza margine.
 *
 * Sprint 60 · T1.3 (voce #2144): 30 byte in più, l'impronta di zr-auth che ogni richiesta della cornice porta in `X-Zr-Persona`
 * (zr-pm, 15/10/2026, nota 13648: eccezione per la sicurezza fra persone).
 *
 * Sprint 61 · T1 (voce #2150): altri 7 byte, perché ogni richiesta porta l'impronta della cornice che la fa e non quella
 * dell'ultima montata (zr-pm, 15/10/2026, nota 13713 del progetto: la stessa eccezione, per questa sola correzione).
 * v2.25.3: altri 16 byte, la riga del registro che apre il contatto dalla notifica del credito sotto zero (zr-pm, 24/10/2026,
 * Decisione 16110: se una patch libera byte nel registro, il tetto riscende).
 *
 * Sprint 70 · T1 (voce #2429): è la versione maggiore, la `v3.0.0`. Le righe delle destinazioni delle notifiche escono dal
 * registro dell'ingresso (`resources/registro/notifiche.json`) e vanno nel pezzo della campanella, con la funzione che le legge:
 * `destinazioneDellaNotifica` si importa da `./frasi`. Il tetto scende a ciò che l'ingresso pesa (zr-pm, 24/10/2026, Decisione
 * 16181).
 *
 * v3.2.3 (voce 2544): altri 17 byte sul tetto (la misura è 19 sopra la v3.2.2, che pesava 17.476), perché un modulo spento
 * non si mostra a chi non può attivarlo, come nella griglia della Home, tranne il modulo aperto e i «Presto» del registro
 * (zr-pm, 24/10/2026, Decisioni 16812 e 16828: se una patch futura libera byte, il tetto riscende).
 */
const TETTO_DELL_INGRESSO = 17_495;
/**
 * Ciò che nel codice costruito c'è solo dove si compone la riga di una notifica: il posto del nome della cosa in una frase.
 * Le frasi lo hanno anche loro, ma sono file `.json`, non pezzi di codice.
 */
const DELLA_CAMPANELLA = '{what}';
/** Le tre funzioni per chi mostra le notifiche in una pagina sua: dalla `v2.0.0` si importano da `resources/js/frasi`. */
const PER_LE_PAGINE = ['destinazioneDellaNotifica', 'rigaDellaNotifica', 'risorsaDellaNotifica', 'titoloDellaNotifica'];
/** Ciò che nel codice costruito c'è solo nelle righe delle destinazioni delle notifiche: il tipo di una pipeline nuova (dalla `v3.0.0`). */
const DELLE_DESTINAZIONI = 'com.zeiras.crm.pipeline.creata';
/** Ciò che nel codice costruito c'è solo nel pezzo della ricerca: l'indirizzo della sua rotta (dalla `v2.8.0`). */
const DELLA_RICERCA = '/cornice/ricerca';
/** Ciò che nel codice costruito c'è solo nei rimedi provvisori di tastiera. */
const DEI_RIMEDI = 'MutationObserver';
/** Ciò che nel codice costruito c'è solo nella barra minima di chi non ha i dati della cornice (sprint 68 · T1). */
const DELLA_BARRA = 'var(--topbar-height)';

interface Costruito {
    /** Il JS d'ingresso: ciò che la pagina scarica subito, coi pezzi che l'ingresso importa in modo statico. */
    js: string;
    /** Ciò che si scarica a richiesta: i pezzi, uno per `import()`, e i file delle frasi, che la cornice chiede con `fetch`. */
    aRichiesta: string[];
    /** Di ciò che si scarica a richiesta, i soli pezzi di codice. */
    pezzi: string[];
    /** I nomi dei file delle frasi nella build. */
    fileDelleFrasi: string[];
    esporta: string[];
    /** Il CSS d'ingresso: quello dei pezzi che la pagina scarica subito (sprint 75 · T2). */
    css: string;
    /** Il CSS dei pezzi a richiesta, uno per pezzo che ne ha. */
    cssARichiesta: string[];
}

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../${percorso}`, import.meta.url));
const gzip = (js: string) => gzipSync(js, { level: 9 }).length;
const volte = (testo: string, parte: string) => testo.split(parte).length - 1;
const inKb = (byte: number) => byte / 1024;
const scritture = (js: string, globale: string) => [...js.matchAll(new RegExp(`window\\.${globale}\\s*=(?!=)`, 'g'))].length;

function costruito(esito: Awaited<ReturnType<typeof build>>): Costruito {
    const uscite = (Array.isArray(esito) ? esito : [esito]).flatMap((uscita) => ('output' in uscita ? uscita.output : []));
    const pezzi = uscite.filter((uscita) => uscita.type === 'chunk');
    const frasi = uscite.filter((uscita) => uscita.type === 'asset').filter((uscita) => uscita.fileName.endsWith('.json'));
    const fogli = new Map(uscite.filter((uscita) => uscita.type === 'asset' && uscita.fileName.endsWith('.css')).map((uscita) => [uscita.fileName, uscita.type === 'asset' && typeof uscita.source === 'string' ? uscita.source : '']));
    const cssDi = (pezzo: (typeof pezzi)[number]) => [...(pezzo.viteMetadata?.importedCss ?? [])].map((nome) => fogli.get(nome) ?? '').join('\n');

    return {
        js: pezzi.filter((pezzo) => !pezzo.isDynamicEntry).map((pezzo) => pezzo.code).join('\n'),
        aRichiesta: [...pezzi.filter((pezzo) => pezzo.isDynamicEntry).map((pezzo) => pezzo.code), ...frasi.map((uscita) => (typeof uscita.source === 'string' ? uscita.source : Buffer.from(uscita.source).toString()))],
        pezzi: pezzi.filter((pezzo) => pezzo.isDynamicEntry).map((pezzo) => pezzo.code),
        fileDelleFrasi: frasi.map((uscita) => uscita.fileName).sort(),
        esporta: pezzi.flatMap((pezzo) => (pezzo.isEntry ? pezzo.exports : [])).sort(),
        css: pezzi.filter((pezzo) => !pezzo.isDynamicEntry).map(cssDi).join('\n'),
        cssARichiesta: pezzi.filter((pezzo) => pezzo.isDynamicEntry).map(cssDi).filter((css) => css !== ''),
    };
}

/** Un'app di prova, costruita come la costruisce un frontend: minificata, con React fuori. */
async function app(file: string, delFrontend: { assetsInlineLimit?: number } = {}, prima: Plugin[] = []): Promise<Costruito> {
    return costruito(await build({ configFile: false, root: delRepo(''), logLevel: 'silent', plugins: [...prima, react()], build: { ...delFrontend, write: false, minify: true, rolldownOptions: { input: delRepo(file), external: FUORI } } }));
}

/** Un'app che non ha un file suo: importa quei file del repo, nell'ordine, e nient'altro. Costruita come le altre app di prova. */
async function appCheImporta(file: string[]): Promise<Costruito> {
    return appColTesto(file.map((uno) => `import ${JSON.stringify(delRepo(uno))};`).join('\n'));
}

/** Un'app che non ha un file suo: il suo JS è questo testo. Costruita come le altre app di prova. */
async function appColTesto(testo: string): Promise<Costruito> {
    const nome = 'virtuale:ingresso';
    const senzaFile: Plugin = {
        name: 'zr-core:ingresso-senza-file',
        resolveId: (id) => (id === nome ? `\0${nome}` : null),
        load: (id) => (id === `\0${nome}` ? testo : null),
    };

    return costruito(await build({ configFile: false, root: delRepo(''), logLevel: 'silent', plugins: [react(), senzaFile], build: { write: false, minify: true, rolldownOptions: { input: nome, external: FUORI } } }));
}

/** Un ingresso del pacchetto, costruito come lo costruisce `npm run build` (vite.config.ts). */
async function ingresso(file: string): Promise<Costruito> {
    return costruito(await build({ configFile: delRepo('vite.config.ts'), root: delRepo(''), logLevel: 'silent', build: { write: false, lib: { entry: delRepo(file) } } }));
}

/** I nomi fra le graffe degli `export { … } from` di un ingresso, coi `type` davanti dove ci sono. */
function nomiNelTesto(file: string): string[] {
    return [...readFileSync(delRepo(file), 'utf8').matchAll(/^export \{([^}]*)\} from '[^']+';$/gm)]
        .flatMap((riga) => (riga[1] ?? '').split(','))
        .map((nome) => nome.trim())
        .filter((nome) => nome !== '')
        .sort();
}

/**
 * La riga della tabella dei pesi del README che comincia con quel nome: i quattro numeri, in KB, senza e con gzip, del JS
 * d'ingresso e poi dei pezzi a richiesta.
 */
function pesiNelReadme(nome: string): number[] {
    const riga = readFileSync(delRepo('README.md'), 'utf8').split('\n').find((questa) => questa.startsWith(`| ${nome} |`)) ?? '';

    return [...riga.matchAll(/\| (\d+(?:,\d)?) KB/g)].map((trovato) => Number((trovato[1] ?? '').replace(',', '.')));
}

/** Un'app che prende il layout della cornice (sprint 68 · T1): quella che, senza dati, chiede la barra minima. */
let conIlLayout: Costruito;
let soloCornice: Costruito;
let coiDatiDentro: Costruito;
let conIlLimiteAlto: Costruito;
let perNome: Costruito;
let diSempre: Costruito;
let ingressoPerLeApp: Costruito;
let ingressoDiSempre: Costruito;
let ingressoDelleFrasi: Costruito;
let dalBundle: Costruito;
let dalModulo: Costruito;
let conIDatiDiEsempio: Costruito;
let conMentionAParte: Costruito;
let conMentionDaComponenti: Costruito;
let conAddressAParte: Costruito;
let conAddressDaComponenti: Costruito;
let iDueConIlBundle: Costruito;
let iDueConZeirasCss: Costruito;

// Sprint 50 · T1 (voce 2073). I dati di esempio del design system (un `var SAMPLE_… = [` del modulo, come i contatti finti di
// `CrmContacts`) e i due formattatori dei numeri (`NF`, `EUR`, cioè `new Intl.NumberFormat`) li usano solo componenti che la
// cornice non usa: il generatore li segna puri (scripts/componenti-genera.mjs), e la build di un'app li lascia fuori dove nessuno
// li usa. Si cercano tutti i `SAMPLE_` del modulo, e non solo quelli di oggi: un design system importato con un dato di esempio
// nuovo, non segnato, fa rosso qui invece di riprendersi i byte in silenzio. Di ognuno si guardano i testi fra apici di almeno otto
// caratteri che nel modulo stanno solo lì (i nomi, le email dei contatti finti): un testo più corto, o che il modulo usa anche
// altrove, potrebbe stare nell'ingresso per un'altra ragione.
const DATI_DI_ESEMPIO = [...generato.matchAll(/^ {2}var (SAMPLE_\w+) = (?:\/\* @__PURE__ \*\/ )?\[\n([\s\S]*?)\n {2}\]/gm)].map((trovato) => {
    const testi = [...(trovato[2] ?? '').matchAll(/'([^'\n]*)'/g)].map((testo) => testo[1] ?? '');

    return [trovato[1] ?? '', testi.filter((testo) => testo.length >= 8 && volte(generato, `'${testo}'`) === 1)] as const;
});
const DEI_CONTATTI_FINTI = 'anna.ferri@rossilogistica.it';
const DEI_FORMATTATORI = 'NumberFormat';

// vitest gira con NODE_ENV=test, e così il plugin di React renderebbe il JSX come in sviluppo, più pesante: qui si costruisce
// come fa `vite build`, in produzione.
beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    soloCornice = await app('resources/demo/peso/cornice.ts');
    // Sprint 50 · T6 (review, R9): la stessa app col modulo dei componenti senza i segni «puri» del generatore.
    coiDatiDentro = await app('resources/demo/peso/cornice.ts', {}, [{
        name: 'zr-core:componenti-senza-segni',
        enforce: 'pre',
        load: (id) => (id.endsWith('/resources/js/zeiras/componenti.js') ? generato.replaceAll('/* @__PURE__ */ ', '') : null),
    }]);
    conIlLimiteAlto = await app('resources/demo/peso/cornice.ts', { assetsInlineLimit: 1_000_000 });
    perNome = await app('resources/demo/peso/per-nome.ts');
    diSempre = await app('resources/demo/peso/oggi.ts');
    conIlLayout = await appColTesto(`import { LayoutDellaCornice } from ${JSON.stringify(delRepo('resources/js/app.ts'))};\nconsole.log(LayoutDellaCornice);`);
    ingressoPerLeApp = await ingresso('resources/js/app.ts');
    ingressoDiSempre = await ingresso('resources/js/index.ts');
    ingressoDelleFrasi = await ingresso('resources/js/frasi.ts');
    dalBundle = await appCheImporta(DAL_BUNDLE);
    dalModulo = await appCheImporta(DAL_MODULO);
    // Sprint 71 · T1.1 (voce #2433): la cornice nell'ingresso e una pagina a richiesta con MentionField, preso dal suo modulo o
    // da quello dei componenti.
    const conLaPaginaCheLoPrende = (da: string, nome: string) => appColTesto([
        `import { Cornice } from ${JSON.stringify(delRepo('resources/js/app.ts'))};`,
        'console.log(Cornice);',
        `globalThis.apri = () => import(${JSON.stringify(delRepo(da))}).then((pagina) => console.log(pagina.${nome}));`,
    ].join('\n'));
    conMentionAParte = await conLaPaginaCheLoPrende('resources/js/zeiras/MentionField.js', 'MentionField');
    conMentionDaComponenti = await conLaPaginaCheLoPrende('resources/js/zeiras/componenti.js', 'MentionField');
    // Sprint 72 · T1.1 (voce #2454): lo stesso con AddressField.
    conAddressAParte = await conLaPaginaCheLoPrende('resources/js/zeiras/AddressField.js', 'AddressField');
    conAddressDaComponenti = await conLaPaginaCheLoPrende('resources/js/zeiras/componenti.js', 'AddressField');
    // Sprint 75 · T2 (voce #2570): la cornice nell'ingresso, MentionField e AddressField presi dai loro moduli in due pagine a
    // richiesta, e il CSS come lo importa un frontend (il design system, poi i token): una volta `bundle.css`, una `zeiras.css`.
    const iDueCon = (css: string) => appColTesto([
        `import ${JSON.stringify(delRepo(css))};`,
        `import ${JSON.stringify(delRepo('resources/css/zeiras-token.css'))};`,
        `import { Cornice } from ${JSON.stringify(delRepo('resources/js/app.ts'))};`,
        'console.log(Cornice);',
        `globalThis.menzioni = () => import(${JSON.stringify(delRepo('resources/js/zeiras/MentionField.js'))}).then((pagina) => console.log(pagina.MentionField));`,
        `globalThis.indirizzi = () => import(${JSON.stringify(delRepo('resources/js/zeiras/AddressField.js'))}).then((pagina) => console.log(pagina.AddressField));`,
    ].join('\n'));
    iDueConIlBundle = await iDueCon('resources/zeiras/bundle.css');
    iDueConZeirasCss = await iDueCon('resources/css/zeiras.css');
    conIDatiDiEsempio = await appColTesto(`import { CrmContacts, DealCard } from ${JSON.stringify(delRepo('resources/js/zeiras/componenti.js'))};\nconsole.log(CrmContacts, DealCard);`);
    vi.unstubAllEnvs();
}, 120_000);

describe('un\'app che prende solo la cornice dall\'ingresso per le app non porta i componenti che la cornice non usa (T2.1)', () => {
    it.each(DI_ALTRI)('«%s» non c\'è; nella stessa app dall\'ingresso di sempre sì', (testo) => {
        expect(soloCornice.js).not.toContain(testo);
        expect(diSempre.js).toContain(testo);
    });

    it('c\'è l\'AppShell', () => {
        expect(soloCornice.js).toContain(DELLA_CORNICE);
    });

    it('pesa, con gzip, al più il 60% della stessa app dall\'ingresso di sempre', () => {
        expect(gzip(soloCornice.js)).toBeLessThanOrEqual(0.6 * gzip(diSempre.js));
    });
});

describe('un\'app che usa anche due componenti per nome porta quelli e non gli altri (T2.2)', () => {
    it('la tabella e il pulsante ci sono; senza usarla, la tabella non c\'è', () => {
        expect(perNome.js).toContain(DELLA_TABELLA);
        expect(perNome.js).toContain(DEL_PULSANTE);
        expect(soloCornice.js).not.toContain(DELLA_TABELLA);
    });

    it.each(DI_ALTRI)('«%s» non c\'è', (testo) => {
        expect(perNome.js).not.toContain(testo);
    });

    it('pesa più della sola cornice e, con gzip, al più il 70% della stessa app dall\'ingresso di sempre', () => {
        expect(gzip(perNome.js)).toBeGreaterThan(gzip(soloCornice.js));
        expect(gzip(perNome.js)).toBeLessThanOrEqual(0.7 * gzip(diSempre.js));
    });
});

// Sprint 71 · T1.1, T1.2 (voce #2433, Decisione 16375). `componenti.js` è un modulo solo: se l'ingresso lo importa (la cornice lo
// fa), sta nell'ingresso con tutto ciò che una qualunque pagina ne usa, anche una pagina a richiesta. MentionField ha per questo un
// modulo suo: preso da lì, sta nel pezzo della pagina. La classe del suo campo, `zr-mention`, è il segno del suo codice.
const DI_MENTIONFIELD = 'zr-mention';

describe('MentionField preso dal suo modulo in una pagina a richiesta sta nel pezzo della pagina, non nel JS d\'ingresso (sprint 71 · T1.1, T1.2)', () => {
    it('dal suo modulo: nel JS d\'ingresso non c\'è, nel pezzo a richiesta sì', () => {
        expect(conMentionAParte.js).toContain(DELLA_CORNICE);
        expect(conMentionAParte.js).not.toContain(DI_MENTIONFIELD);
        expect(conMentionAParte.pezzi.filter((pezzo) => pezzo.includes(DI_MENTIONFIELD))).toHaveLength(1);
    });

    it('da componenti, com\'era prima: è nel JS d\'ingresso, e l\'ingresso pesa di più', () => {
        expect(conMentionDaComponenti.js).toContain(DI_MENTIONFIELD);
        expect(gzip(conMentionDaComponenti.js)).toBeGreaterThan(gzip(conMentionAParte.js));
    });

    it('l\'app che prende solo la cornice non lo porta', () => {
        expect(soloCornice.js).not.toContain(DI_MENTIONFIELD);
    });
});

// Sprint 72 · T1.1, T1.2 (voce #2454, Decisione 16431): AddressField come MentionField. La classe del suo campo, `zr-address`, è
// il segno del suo codice (le classi `zr-mention-*` le usa anche lui, e non lo distinguono).
const DI_ADDRESSFIELD = 'zr-address';

describe('AddressField preso dal suo modulo in una pagina a richiesta sta nel pezzo della pagina, non nel JS d\'ingresso (sprint 72 · T1.1, T1.2)', () => {
    it('dal suo modulo: nel JS d\'ingresso non c\'è, nel pezzo a richiesta sì, e MentionField non c\'è da nessuna parte', () => {
        expect(conAddressAParte.js).toContain(DELLA_CORNICE);
        expect(conAddressAParte.js).not.toContain(DI_ADDRESSFIELD);
        expect(conAddressAParte.pezzi.filter((pezzo) => pezzo.includes(DI_ADDRESSFIELD))).toHaveLength(1);
        expect([conAddressAParte.js, ...conAddressAParte.pezzi].filter((testo) => testo.includes('zr-mention-chip'))).toStrictEqual([]);
    });

    it('da componenti: è nel JS d\'ingresso, e l\'ingresso pesa di più', () => {
        expect(conAddressDaComponenti.js).toContain(DI_ADDRESSFIELD);
        expect(gzip(conAddressDaComponenti.js)).toBeGreaterThan(gzip(conAddressAParte.js));
    });

    it('l\'app che prende solo la cornice non lo porta, né la pagina che prende MentionField dal suo modulo', () => {
        expect([soloCornice.js, conMentionAParte.js, ...conMentionAParte.pezzi].filter((testo) => testo.includes(DI_ADDRESSFIELD))).toStrictEqual([]);
    });
});

// Sprint 75 · T2 (voce #2570, Decisione 17002). `zeiras.css` è `bundle.css` senza gli stili di MentionField e AddressField, che
// arrivano col modulo di ognuno: in un'app che li prende dai loro moduli, a richiesta, il CSS del primo carico non li porta. Il
// confronto è fra due build fatte qui, mai con un numero scritto a mano.
const DEI_DUE_CAMPI = /\.zr-(?:mention|address)\b/;

describe('con zeiras.css gli stili di MentionField e AddressField arrivano col loro modulo, non nel CSS d\'ingresso (sprint 75 · T1.3)', () => {
    it('con bundle.css stanno nel CSS d\'ingresso; con zeiras.css no, e stanno nel CSS dei due pezzi a richiesta', () => {
        expect(iDueConIlBundle.css).toMatch(DEI_DUE_CAMPI);
        expect(iDueConZeirasCss.css).toContain('.zr-shell');
        expect(iDueConZeirasCss.css).not.toMatch(DEI_DUE_CAMPI);
        expect(iDueConZeirasCss.cssARichiesta.join('\n')).toMatch(/\.zr-mention-x\b/);
        expect(iDueConZeirasCss.cssARichiesta.join('\n')).toMatch(/\.zr-address\b/);
    });

    it('il pezzo di AddressField porta anche le regole `.zr-mention-*` che il campo usa (T1.2)', () => {
        const dell = iDueConZeirasCss.cssARichiesta.filter((css) => /\.zr-address\b/.test(css));

        expect(dell).toHaveLength(1);
        for (const classe of ['.zr-mention-x', '.zr-mention-list', '.zr-mention-opt']) {
            expect(dell[0]).toMatch(new RegExp(`\\${classe}\\b`));
        }
    });

    // Minificati dalla build i due blocchi pesano meno che nel file: 515 byte con gzip -9 tolti da `bundle.css`, 472 dal CSS
    // d'ingresso costruito, il 25/10/2026. Di qui il tetto di 450, scritto nell'AC.
    it('il CSS d\'ingresso pesa, con gzip -9, almeno 450 byte meno che con bundle.css', () => {
        expect(gzip(iDueConIlBundle.css) - gzip(iDueConZeirasCss.css)).toBeGreaterThanOrEqual(450);
    });

    it.each([
        ['la cornice e i due campi a richiesta, con `bundle.css`', () => iDueConIlBundle],
        ['la cornice e i due campi a richiesta, con `zeiras.css`', () => iDueConZeirasCss],
    ])('«%s»: i quattro numeri della sua riga nel README, in KB, senza e con gzip: il CSS d\'ingresso e quello dei pezzi a richiesta', (nome, misurato) => {
        const [intero, compresso, aRichiesta, aRichiestaCompressi, ...altri] = pesiNelReadme(nome);
        const fogli = misurato().cssARichiesta;

        expect(intero).toBeCloseTo(inKb(Buffer.byteLength(misurato().css)), 0);
        expect(compresso).toBeCloseTo(inKb(gzip(misurato().css)), 0);
        expect(aRichiesta).toBeCloseTo(inKb(fogli.reduce((somma, foglio) => somma + Buffer.byteLength(foglio), 0)), 0);
        expect(aRichiestaCompressi).toBeCloseTo(inKb(fogli.reduce((somma, foglio) => somma + gzip(foglio), 0)), 0);
        expect(altri).toStrictEqual([]);
    });

    it('il font di Google resta la prima regola del CSS d\'ingresso, in tutte e due', () => {
        for (const costruita of [iDueConIlBundle, iDueConZeirasCss]) {
            expect(costruita.css.trimStart()).toMatch(/^@import (?:url\()?["']?https:\/\/fonts\.googleapis\.com\//);
        }
    });
});

describe('i dati di esempio del design system e i formattatori dei numeri non stanno nell\'ingresso dell\'app che prende solo la cornice (sprint 50 · T1.1, T1.2)', () => {
    it('il modulo dei componenti ha dei dati di esempio, e ognuno ha dei testi suoi', () => {
        expect(DATI_DI_ESEMPIO.map(([nome]) => nome)).toContain('SAMPLE_CONTACTS');
        expect(DATI_DI_ESEMPIO.filter(([, testi]) => testi.length === 0)).toEqual([]);
    });

    it.each(DATI_DI_ESEMPIO)('di %s non c\'è niente; nell\'app dall\'ingresso di sempre sì', (_nome, testi) => {
        expect(testi.filter((testo) => soloCornice.js.includes(testo))).toEqual([]);
        expect(testi.some((testo) => diSempre.js.includes(testo))).toBe(true);
    });

    it('nell\'app che prende CrmContacts per nome i contatti finti ci sono: il segno li lascia dove servono', () => {
        expect(conIDatiDiEsempio.js).toContain(DEI_CONTATTI_FINTI);
    });

    it('i formattatori dei numeri non ci sono; nell\'app dall\'ingresso di sempre, e in quella che prende DealCard per nome, sì', () => {
        expect(soloCornice.js).not.toContain(DEI_FORMATTATORI);
        expect(diSempre.js).toContain(DEI_FORMATTATORI);
        expect(conIDatiDiEsempio.js).toContain(DEI_FORMATTATORI);
    });
});

describe('le frasi delle notifiche non stanno nel JS d\'ingresso: sono file a richiesta, uno per lingua (sprint 30 · T1.1, T1.2, T1.8)', () => {
    const app = [
        ['solo la cornice, dall\'ingresso per le app', () => soloCornice],
        ['la cornice e due componenti per nome', () => perNome],
        ['la stessa cornice, dall\'ingresso di sempre', () => diSempre],
    ] as const;

    it.each(app)('«%s»: nel JS d\'ingresso nessuna frase, di nessuna lingua', (_nome, costruita) => {
        expect(Object.values(FRASI).filter((frase) => costruita().js.includes(frase))).toStrictEqual([]);
    });

    // Un file di dati, non un modulo: la cornice lo chiede con `fetch`, e «Riprova» lo può richiedere (in Chrome un `import()`
    // fallito resta fallito finché la pagina non si ricarica: UAT dello sprint 30). Il nome porta l'impronta del contenuto: una
    // build nuova con frasi nuove ha un altro nome, e la cache di un browser non dà mai le frasi di prima.
    it.each(app)('«%s»: i file delle frasi sono tre `.json`, uno per lingua, con l\'impronta della build nel nome', (_nome, costruita) => {
        expect(costruita().fileDelleFrasi.map((nome) => nome.replace(/-[\w-]{8,}\.json$/, '-<impronta>.json'))).toStrictEqual(['assets/en-<impronta>.json', 'assets/es-<impronta>.json', 'assets/it-<impronta>.json']);
    });

    it.each(app)('«%s»: tre file a richiesta con le frasi, ognuno di una lingua sola; gli altri tre sono pezzi di codice, senza frasi: la campanella, la ricerca e i rimedi di tastiera', (_nome, costruita) => {
        const lingueDeiPezzi = costruita().aRichiesta.map((pezzo) => Object.entries(FRASI).flatMap(([lingua, frase]) => (pezzo.includes(frase) ? [lingua] : [])));

        expect(lingueDeiPezzi.sort()).toStrictEqual([[], [], [], ['en'], ['es'], ['it']]);
        expect(costruita().pezzi).toHaveLength(3);
    });

    // Sprint 33 · T1.2 (voce #1915). Che il pezzo si chieda all'apertura della campanella, e non al montaggio, lo provano i casi
    // della cornice (`cornice.test.tsx`).
    it.each(app)('«%s»: ciò che compone la riga di una notifica non sta nel JS d\'ingresso ma in un pezzo a richiesta solo, che non è quello dei rimedi (sprint 33 · T1.2)', (_nome, costruita) => {
        expect(volte(costruita().js, DELLA_CAMPANELLA)).toBe(0);
        expect(costruita().pezzi.map((pezzo) => [pezzo.includes(DELLA_CAMPANELLA), pezzo.includes(DEI_RIMEDI)]).sort()).toStrictEqual([[false, false], [false, true], [true, false]]);
    });

    // Sprint 42 · T2.1 (voce #2054). Che il pezzo si chieda al primo fuoco nel campo, o alla prima parola, e non al montaggio, lo
    // provano i casi della cornice (`ricerca-a-richiesta.test.tsx`).
    it.each(app)('«%s»: la richiesta della ricerca non sta nel JS d\'ingresso ma in un pezzo a richiesta solo, che non è quello della campanella né quello dei rimedi (sprint 42 · T2.1)', (_nome, costruita) => {
        expect(volte(costruita().js, DELLA_RICERCA)).toBe(0);
        expect(costruita().pezzi.filter((pezzo) => pezzo.includes(DELLA_RICERCA)).map((pezzo) => [pezzo.includes(DELLA_CAMPANELLA), pezzo.includes(DEI_RIMEDI)])).toStrictEqual([[false, false]]);
    });

    // Sprint 39 · T4 (voci #1972 e #1973). Dopo un pezzo non arrivato «Riprova» lo importa col nome che la build ha scritto nel
    // JS d'ingresso, dentro `import(` e fra virgolette (`pezzoARichiesta`, in `lingue.ts`). Una build che lo scrivesse in un
    // altro modo lascerebbe a «Riprova» l'`import()` di prima, che in Chromium non fa partire niente.
    it.each(app)('«%s»: nel JS d\'ingresso il nome del pezzo della campanella sta fra virgolette dentro `import(`, dove «Riprova» lo legge, e così quello della ricerca (sprint 39 · T4.2; sprint 42 · T2.1)', (_nome, costruita) => {
        const nomi = [...costruita().js.matchAll(/import\(([\x22\x27\x60])(.+?)\1/g)].map(([, , nome = '']) => nome.replace(/-[\w-]{8,}\.js$/, '-<impronta>.js'));

        expect(nomi.sort()).toStrictEqual(['./campanella-<impronta>.js', './ricerca-<impronta>.js', './rimedi-<impronta>.js']);
    });

    // Il pezzo importa il JS d'ingresso col nome del file, senza code: se un frontend serve l'ingresso con una coda sua
    // (`app.js?v=3`), per il browser quello che il pezzo chiede è un altro indirizzo (README, «Le notifiche»).
    it.each(app)('«%s»: il pezzo della campanella importa il JS d\'ingresso col suo nome di file, senza una coda (sprint 39 · T4.5)', (_nome, costruita) => {
        const [campanella = ''] = costruita().pezzi.filter((pezzo) => pezzo.includes(DELLA_CAMPANELLA));

        const importati = [...campanella.matchAll(/from\s*([\x22\x27\x60])(.+?)\1/g)].map(([, , nome]) => nome);

        expect(importati).toHaveLength(1);
        expect(importati[0]).toMatch(/^\.\/[\w-]+\.js$/);
    });

    // Sprint 33 · T2.4 (voce #1890): il taglio del nome di chi ha fatto (`Intl.Segmenter`) sta nel pezzo della campanella.
    it.each(app)('«%s»: il taglio del nome di chi ha fatto non sta nel JS d\'ingresso ma nel pezzo della campanella (sprint 33 · T2.4)', (_nome, costruita) => {
        expect(volte(costruita().js, 'Segmenter')).toBe(0);
        expect(costruita().pezzi.map((pezzo) => [pezzo.includes(DELLA_CAMPANELLA), pezzo.includes('Segmenter')]).sort()).toStrictEqual([[false, false], [false, false], [true, true]]);
    });

    it.each(app)('«%s»: i rimedi provvisori di tastiera stanno in un pezzo a richiesta solo, non nel JS d\'ingresso (sprint 30 · T3)', (_nome, costruita) => {
        expect(costruita().js).not.toContain(DEI_RIMEDI);
        expect(costruita().aRichiesta.filter((pezzo) => pezzo.includes(DEI_RIMEDI))).toHaveLength(1);
    });

    it('in un frontend che alza `build.assetsInlineLimit` i file delle frasi restano file: come `data:` nel JS la CSP di tutti (`connect-src \'self\'`) fermerebbe la richiesta (sprint 30 · T1)', () => {
        expect(conIlLimiteAlto.fileDelleFrasi).toHaveLength(3);
        expect(conIlLimiteAlto.js).not.toContain('data:application/json');
    });

    // Sprint 42 · T3 (voce #2054, T2.5): con la ricerca in un pezzo a richiesta il tetto era sceso a 18.229 byte. Sprint 50 ·
    // T5.4 (voce #2056): coi dati di esempio e i formattatori fuori dall'ingresso è ciò che l'ingresso pesa a fine sprint.
    it('l\'app che prende solo la cornice pesa all\'ingresso, con gzip, al più 17.495 byte: la misura della v3.2.3 (+17 sul tetto della v3.0.0, il modulo spento che non si mostra a chi non può attivarlo: Decisioni 16812 e 16828), e prima quella della v3.0.0, con le righe delle destinazioni delle notifiche nel pezzo della campanella (Decisione 16181), dopo la misura a fine sprint 50 più le eccezioni di zr-pm del 21/10 (+49), del 22/10 (+25), del 23/10 (+18, il nome del contenuto e il suo cambio di lingua: voce 2394) e del 24/10 (+16, la destinazione del credito sotto zero: Decisione 16110), con i dati di esempio e i formattatori dei numeri fuori dall\'ingresso e le correzioni dello sprint dentro, più l\'impronta di zr-auth, quella della cornice che chiede (sprint 42 · T2.5; sprint 50 · T5.4; sprint 60 · T1.3; sprint 61 · T1; sprint 70 · T1.1; voce 2544 T1.4)', () => {
        expect(gzip(soloCornice.js)).toBeLessThanOrEqual(TETTO_DELL_INGRESSO);
        expect(TETTO_DELL_INGRESSO).toBe(17_495);
    });

    // Sprint 70 · T1.1 (voce #2429): le righe delle destinazioni stanno solo nel pezzo della campanella, che le legge quando un
    // clic apre una notifica. Nessun ingresso le porta: con `app` che esportava ancora `destinazioneDellaNotifica` l'ingresso
    // pesava 17.955 byte.
    it('le righe delle destinazioni delle notifiche non stanno nel JS d\'ingresso, né in quello dei due ingressi: stanno nel pezzo della campanella, una volta (sprint 70 · T1.1)', () => {
        const [campanella = ''] = soloCornice.pezzi.filter((pezzo) => pezzo.includes(DELLA_CAMPANELLA));

        expect([soloCornice.js, ingressoPerLeApp.js, ingressoDiSempre.js].map((js) => volte(js, DELLE_DESTINAZIONI))).toStrictEqual([0, 0, 0]);
        expect(volte(campanella, DELLE_DESTINAZIONI)).toBe(1);
    });

    // Sprint 50 · T6 (review, R9). Il tetto è la misura con una tolleranza scelta di 99 byte, non più: un ingresso che scende
    // di 100 byte o più vuole il tetto riscritto (zr-pm: «niente oltre»). E i segni «puri» del generatore tolgono dall'ingresso almeno 500 byte
    // (T1.4: 515 alla misura di T1): qui la stessa app, costruita col modulo dei componenti senza i segni.
    it('il tetto sta a meno di 100 byte da ciò che l\'ingresso pesa, e senza i segni «puri» del modulo dei componenti l\'ingresso pesa almeno 500 byte di più (sprint 50 · T1.4, T5.4)', () => {
        expect(TETTO_DELL_INGRESSO - gzip(soloCornice.js)).toBeLessThan(100);
        expect(volte(coiDatiDentro.js, DEI_CONTATTI_FINTI)).toBe(1);
        expect(gzip(coiDatiDentro.js) - gzip(soloCornice.js)).toBeGreaterThanOrEqual(500);
    });

    it.each(['README.md', 'CLAUDE.md'])('%s dice il tetto di 17.495 byte, e il 17.478 della v3.0.0 solo dove il README dice come passare alla v3; non più quelli di 17.934, di 17.918, di 17.911, di 17.900, di 17.875, di 17.826, di 17.819, di 17.789, di 18.229, di 18.554, di 18.486, di 18.449 e di 18.432 e nemmeno quello coi 32 byte in più (sprint 33 · T1.3; sprint 36 · T2.6, T3.5; sprint 37 · T4.5; sprint 42 · T2.5; sprint 50 · T5.4; sprint 61 · T1; v2.25.3; sprint 70 · T1.1; voce 2544 T1.4)', (file) => {
        const testo = readFileSync(delRepo(file), 'utf8');

        // «32 byte» da soli, non dentro un altro numero.
        expect(volte(testo, '17.478')).toBe(file === 'README.md' ? 1 : 0);
        expect([volte(testo, '17.495 byte') > 0, volte(testo, '17.490'), volte(testo, '17.934'), volte(testo, '17.918'), volte(testo, '17.911'), volte(testo, '17.900'), volte(testo, '17.875'), volte(testo, '17.826'), volte(testo, '17.819'), volte(testo, '17.789'), volte(testo, '18.229'), volte(testo, '18.554'), volte(testo, '18.486'), volte(testo, '18.449'), volte(testo, '18.432'), volte(testo, '18.464'), [...testo.matchAll(/(?<![\d.])32 byte/g)].length]).toStrictEqual([true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('il pezzo della ricerca pesa, con gzip, al più 1.004 byte: la misura (sprint 42 · T2.5)', () => {
        const [ricerca = ''] = soloCornice.pezzi.filter((pezzo) => pezzo.includes(DELLA_RICERCA));

        expect(ricerca).not.toBe('');
        expect(gzip(ricerca)).toBeLessThanOrEqual(1_004);
    });

    it('il README ha «Passare alla v2» con l\'import di prima e quello nuovo, e dice che cosa fa Chromium quando il pezzo non arriva (sprint 33 · T1.5, T1.7)', () => {
        const readme = readFileSync(delRepo('README.md'), 'utf8');
        const [, passaggio = ''] = /^### Passare alla v2\n(.*?)^##/ms.exec(readme) ?? [];

        expect(passaggio.split('\n').filter((riga) => /^[-+]import /.test(riga))).toStrictEqual([
            '-import { rigaDellaNotifica } from \'../../vendor/zeiras/zr-core/resources/js/app\';',
            '+import { rigaDellaNotifica } from \'../../vendor/zeiras/zr-core/resources/js/frasi\';',
        ]);
        expect(volte(readme.replace(/\s+/g, ' '), 'In Chromium (provato il 13/10/2026 con la 151) un `import()` che non è arrivato resta fallito, per quell\'indirizzo, finché la pagina non si ricarica')).toBe(1);
    });

    // Sprint 70 · T3.1 (voce #2429): la `v3.0.0` sposta `destinazioneDellaNotifica` dai due ingressi a `./frasi`, e il README
    // lo dice: l'import di prima e quello nuovo, il campo che sparisce, i tetti nuovi; e da nessuna parte che si importa ancora
    // dall'ingresso.
    it('il README ha «Passare alla v3» con l\'import di prima e quello nuovo, il campo `notifiche` che sparisce e i tetti nuovi, e non dice più che `destinazioneDellaNotifica` si importa dall\'ingresso (sprint 70 · T3.1)', () => {
        const readme = readFileSync(delRepo('README.md'), 'utf8');
        const [, passaggio = ''] = /^### Passare alla v3\n(.*?)^##/ms.exec(readme) ?? [];
        const suUnaRiga = (testo: string) => testo.replace(/\s+/g, ' ');

        expect(passaggio.split('\n').filter((riga) => /^[-+]import /.test(riga))).toStrictEqual([
            '-import { destinazioneDellaNotifica } from \'../../vendor/zeiras/zr-core/resources/js/app\';',
            '+import { destinazioneDellaNotifica } from \'../../vendor/zeiras/zr-core/resources/js/frasi\';',
        ]);
        expect([
            volte(suUnaRiga(passaggio), 'le voci del `registro` non hanno più il campo `notifiche`'),
            volte(suUnaRiga(passaggio), '17.478 byte con gzip'),
            volte(suUnaRiga(passaggio), '1.969 il pezzo della campanella'),
            volte(suUnaRiga(readme), 'che chi mostra le notifiche in una pagina sua importa dall\'ingresso'),
            volte(suUnaRiga(readme), 'segue si importa ancora dall\'ingresso'),
        ]).toStrictEqual([1, 1, 1, 0, 0]);
    });

    it('il pezzo della campanella pesa, con gzip, al più 1.985 byte: la misura della v3.0.0, con le righe delle destinazioni delle notifiche e le due delle Scadenze (sprint 70 · T1.5, T2.1), più la riga della richiesta sul preventivo (v3.2.2), col taglio del nome di chi ha fatto, con le frasi guardate all\'arrivo e con la riga del conto e della board (sprint 33 · T1.7, T2.4, T3.6; sprint 34 · T2.7; sprint 36 · T5.4)', () => {
        const [campanella = ''] = soloCornice.pezzi.filter((pezzo) => pezzo.includes(DELLA_CAMPANELLA));

        expect(campanella).not.toBe('');
        // Sprint 36 · T5: il pezzo porta l'indirizzo dei file delle frasi, con l'impronta del contenuto nel nome. Coi due tipi dei
        // motivi di perdita i tre file sono cambiati, e le impronte nuove pesano 2 byte in più: il codice del pezzo è quello di prima.
        // Sprint 70 · T1.5 (voce #2429, Decisione 16181): dalla `v3.0.0` porta anche le righe delle destinazioni e la funzione
        // che le legge: 1.922 byte alla misura del prototipo, 1.969 con le due righe delle Scadenze (T2) e le impronte di oggi.
        // Patch v3.2.2 (Decisione 16510 di zr-pm): +16 byte per la riga che apre il preventivo dalla richiesta di un cliente.
        expect(gzip(campanella)).toBeLessThanOrEqual(1_985);
    });

    it('il pezzo dei rimedi provvisori di tastiera pesa, con gzip, al più 1,7 KB (sprint 31 · T3.7; sprint 65 · T2; sprint 69 · T3-T4; patch v2.25.2)', () => {
        const [rimedi = ''] = soloCornice.aRichiesta.filter((pezzo) => pezzo.includes(DEI_RIMEDI));

        expect(rimedi).not.toBe('');
        // Sprint 65 · T2 (voce 2340): +99 byte per l'avatar del menu del profilo nascosto e la barra dei moduli `inert` (Decisione 14804
        // di zr-pm: il tetto dei rimedi sale dei byte di C1 e C2, dopo aver stretto il codice nuovo).
        // Sprint 69 · T3 e T4 (voci #2033 e #2344): +123 byte per i clic della barra laterale che passano da `naviga` e per il piede
        // della barra laterale `inert` col selettore aperto (misura del 22/10; tetto approvato da zr-pm, nota `Decisione:` 15310 del progetto).
        // Patch v2.25.2 (voce #2394): +216 byte per il contenuto che scorre nel giro del Tab, col suo nome e col contorno del fuoco
        // del design system, dopo le due letture della PR #121 (misura del 23/10: 1.666; tetto approvato da zr-pm, nota `Decisione:` 15827).
        expect(gzip(rimedi)).toBeLessThanOrEqual(1_666);
    });

    // Sprint 33 · T1.1 (voce #1915). Chi mostra le notifiche in una pagina sua ha titoli e righe subito, senza aspettare niente:
    // le importa da `resources/js/frasi`, che porta le frasi di ogni lingua. I due ingressi del pacchetto non riesportano più
    // niente da lì: un modulo che un ingresso importa in modo statico resta nel JS d'ingresso anche se la cornice lo chiede con
    // `import()`.
    it.each([
        ['per le app', () => ingressoPerLeApp],
        ['di sempre', () => ingressoDiSempre],
    ])('l\'ingresso %s non esporta le funzioni per le pagine (dalla v3.0.0 anche `destinazioneDellaNotifica`), e non porta né le frasi né ciò che compone le righe (sprint 33 · T1.1; sprint 70 · T1.3)', (_nome, costruito) => {
        expect(PER_LE_PAGINE.filter((nome) => costruito().esporta.includes(nome))).toStrictEqual([]);
        expect(Object.values(FRASI).filter((frase) => costruito().js.includes(frase))).toStrictEqual([]);
        expect(volte(costruito().js, DELLA_CAMPANELLA)).toBe(0);
    });

    it('`resources/js/frasi` esporta le funzioni per le pagine, e solo quelle (dalla v3.0.0 quattro, con `destinazioneDellaNotifica`), con le frasi di ogni lingua (sprint 33 · T1.1; sprint 70 · T1.3)', () => {
        expect(ingressoDelleFrasi.esporta).toStrictEqual(PER_LE_PAGINE);
        expect(Object.values(FRASI).filter((frase) => !ingressoDelleFrasi.js.includes(frase))).toStrictEqual([]);
    });
});

describe('l\'ingresso per le app esporta gli stessi nomi dell\'ingresso di sempre, tranne Zeiras (T2.4)', () => {
    it('nel build: né un nome di meno né uno di più', () => {
        expect(ingressoDiSempre.esporta).toContain('Zeiras');
        expect(ingressoPerLeApp.esporta).toEqual(ingressoDiSempre.esporta.filter((nome) => nome !== 'Zeiras'));
    });

    it('nel testo dei due file: gli stessi nomi, tipi compresi', () => {
        expect(nomiNelTesto('resources/js/index.ts')).toContain('Zeiras');
        expect(nomiNelTesto('resources/js/app.ts')).toEqual(nomiNelTesto('resources/js/index.ts').filter((nome) => nome !== 'Zeiras'));
    });

    it.each(['Zeiras', 'React'])('non scrive window.%s, nemmeno in un\'app: l\'ingresso di sempre sì, una volta', (globale) => {
        expect(scritture(ingressoPerLeApp.js, globale)).toBe(0);
        expect(scritture(soloCornice.js, globale)).toBe(0);
        expect(scritture(ingressoDiSempre.js, globale)).toBe(1);
        expect(scritture(diSempre.js, globale)).toBe(1);
    });
});

describe('chi installa come oggi non paga niente in più (T1.4)', () => {
    it('nel build dell\'ingresso di sempre il testo di un componente sta una volta sola', () => {
        expect(volte(ingressoDiSempre.js, 'Qual è il trucco?')).toBe(1);
    });

    // Lettura della PR #56, R2: il confronto è fra due build fatte qui, non con un numero scritto a mano.
    it('e il design system dal modulo non pesa, con gzip, più di 0,5 KB in più che dal bundle, com\'era sul tag v1.14.0: due build fatte qui', () => {
        // Le due build portano davvero il design system intero, ognuna una volta: altrimenti il confronto non direbbe niente.
        expect([dalBundle, dalModulo].map((costruita) => DI_ALTRI.map((testo) => volte(costruita.js, testo)))).toStrictEqual([[1, 1, 1], [1, 1, 1]]);
        expect(gzip(dalBundle.js)).toBeGreaterThan(20 * 1024);
        expect(gzip(dalModulo.js)).toBeLessThanOrEqual(gzip(dalBundle.js) + MEZZO_KB);
    });
});

describe('i pesi che il README dice sono quelli misurati qui, e la sua ricetta dice il vero (T2.5)', () => {
    it('la ricetta del README per sapere se il passaggio è completo risponde 0 dall\'ingresso per le app e 1 dall\'ingresso di sempre', () => {
        const scritta = /grep -rhoE --include='\*\.js' '([^']+)' public\/build/.exec(readFileSync(delRepo('README.md'), 'utf8'));
        const ricetta = new RegExp(scritta?.[1] ?? 'la ricetta non c\'è', 'g');

        expect([...soloCornice.js.matchAll(ricetta)]).toHaveLength(0);
        expect([...perNome.js.matchAll(ricetta)]).toHaveLength(0);
        expect([...diSempre.js.matchAll(ricetta)]).toHaveLength(1);
    });

    it.each([
        ['solo la cornice, dall\'ingresso per le app', () => soloCornice],
        ['la cornice e due componenti per nome', () => perNome],
        ['la stessa cornice, dall\'ingresso di sempre', () => diSempre],
    ])('«%s»: i quattro numeri della sua riga, in KB, senza e con gzip: il JS d\'ingresso e i pezzi a richiesta (sprint 30 · T1.10)', (nome, misurato) => {
        const [intero, compresso, aRichiesta, aRichiestaCompressi, ...altri] = pesiNelReadme(nome);
        const pezzi = misurato().aRichiesta;

        expect(intero).toBeCloseTo(inKb(Buffer.byteLength(misurato().js)), 0);
        expect(compresso).toBeCloseTo(inKb(gzip(misurato().js)), 0);
        expect(aRichiesta).toBeCloseTo(inKb(pezzi.reduce((somma, pezzo) => somma + Buffer.byteLength(pezzo), 0)), 0);
        expect(aRichiestaCompressi).toBeCloseTo(inKb(pezzi.reduce((somma, pezzo) => somma + gzip(pezzo), 0)), 0);
        expect(altri).toStrictEqual([]);
    });
});

// Sprint 68 · T1 (voce #1399, Decisione 15190 di zr-pm). La barra minima di chi non ha i dati della cornice è PROVVISORIA (il
// design system non ha la sua) e un pezzo a richiesta: il layout la chiede con `import()` solo quando la cornice non c'è. Nel
// JS d'ingresso non c'è il suo codice, e l'app che prende solo la cornice (il tetto di 17.934) non cambia.
describe('la barra minima di chi non ha i dati: un pezzo a richiesta, mai nel JS d\'ingresso (sprint 68 · T1.4)', () => {
    it('nell\'app che prende il layout il suo codice non sta nel JS d\'ingresso ma in un pezzo a richiesta solo, che non è quello della campanella, della ricerca né dei rimedi', () => {
        expect(volte(conIlLayout.js, DELLA_BARRA)).toBe(0);
        expect(conIlLayout.pezzi.filter((pezzo) => pezzo.includes(DELLA_BARRA)).map((pezzo) => [pezzo.includes(DELLA_CAMPANELLA), pezzo.includes(DELLA_RICERCA), pezzo.includes(DEI_RIMEDI)])).toStrictEqual([[false, false, false]]);
    });

    it('il pezzo è chiesto dal layout fra virgolette dentro `import(`, e l\'app che prende solo la cornice non lo porta', () => {
        expect([...conIlLayout.js.matchAll(/import\(([\x22\x27\x60])(.+?)\1/g)].map(([, , nome = '']) => nome.replace(/-[\w-]{8,}\.js$/, '-<impronta>.js')).filter((nome) => nome.startsWith('./barra'))).toStrictEqual(['./barra-<impronta>.js']);
        expect(soloCornice.pezzi.filter((pezzo) => pezzo.includes(DELLA_BARRA))).toHaveLength(0);
        expect(volte(soloCornice.js, DELLA_BARRA)).toBe(0);
    });

    // Patch v2.24.1. Con il JSX il pezzo importava `react/jsx-runtime`: nella build di un frontend che porta React dentro, quel modulo
    // diventava un chunk a sé (612 byte con gzip), perché il pezzo lo chiede senza il resto di React. Misurato su zr-crm: +278 byte, non +110.
    it('il pezzo non importa niente, nemmeno `react/jsx-runtime`: `createElement` glielo dà il layout (patch v2.24.1)', () => {
        const [barra = ''] = conIlLayout.pezzi.filter((pezzo) => pezzo.includes(DELLA_BARRA));

        expect(barra).not.toBe('');
        expect(barra).not.toMatch(/\bimport\b[^()]*?\bfrom\s*[\x22\x27\x60]/);
        expect(barra).not.toContain('react/jsx-runtime');
    });

    it('il pezzo pesa, con gzip, al più 420 byte (463 fino alla v2.24.0; misura della patch v2.24.1)', () => {
        const [barra = ''] = conIlLayout.pezzi.filter((pezzo) => pezzo.includes(DELLA_BARRA));

        expect(barra).not.toBe('');
        expect(gzip(barra)).toBeLessThanOrEqual(420);
    });

});

// Sprint 69 · T3.3 (voce #2033). Il gestore dei clic sulla barra laterale (`naviga` per Dashboard, moduli e «Impostazioni») sta nel
// pezzo dei rimedi, che la cornice chiede a cornice montata: nel JS d'ingresso non c'è il suo codice.
describe('il gestore dei clic sulla barra laterale sta nel pezzo dei rimedi, mai nel JS d\'ingresso (sprint 69 · T3.3)', () => {
    const DEL_GESTORE = '.zr-side a[href]';

    it('nell\'app che prende solo la cornice e in quella che prende il layout non c\'è nel JS d\'ingresso; sta in un pezzo a richiesta solo, quello dei rimedi', () => {
        for (const costruita of [soloCornice, conIlLayout]) {
            expect(volte(costruita.js, DEL_GESTORE)).toBe(0);
            expect(costruita.pezzi.filter((pezzo) => pezzo.includes(DEL_GESTORE)).map((pezzo) => pezzo.includes(DEI_RIMEDI))).toStrictEqual([true]);
        }
    });
});
