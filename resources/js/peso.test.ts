// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import { build, type Plugin } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Sprint 25 · T2 (voce #1759). L'ingresso per le app, `resources/js/app.ts`: la cornice senza `Zeiras`, cioè senza i componenti
// del design system che l'app non usa. Qui si costruiscono le tre app di prova di resources/demo/peso come le costruisce un
// frontend — minificate, React fuori — e i due ingressi come li costruisce `npm run build`, e si guarda il JS che esce: il suo
// testo e il suo peso con gzip. Il caso gira in node: costruisce con Vite, e un DOM non gli serve. I pesi che il README dice
// sono quelli misurati qui.

const FUORI = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

// Un testo per ognuno di tre componenti che la cornice non usa: una domanda della pagina pubblica (`FAQ`), il logo del sito
// (`SiteHeader`), l'intestazione di una colonna (`KanbanColumn`). Poi la tabella (`DataTable`), che entra solo in un'app che la
// usa, e l'`AppShell`, che è la cornice.
const DI_ALTRI = ['Zeiras è davvero gratis?', 'zr-site-logo', 'zr-col-head'];
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

// Sprint 30 · T1 (voce #1875). Le frasi delle notifiche non stanno più nel JS d'ingresso: la cornice le carica quando si apre
// la campanella, un pezzo per lingua. Una frase per lingua, com'è scritta nel suo file: la stessa notifica, la cartella creata.
const FRASI = { it: 'ha creato la cartella', en: 'created the folder', es: 'ha creado la carpeta' };
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
 */
const TETTO_DELL_INGRESSO = 18 * 1024 + 32;
/** Ciò che nel codice costruito c'è solo nei rimedi provvisori di tastiera. */
const DEI_RIMEDI = 'MutationObserver';

interface Costruito {
    /** Il JS d'ingresso: ciò che la pagina scarica subito, coi pezzi che l'ingresso importa in modo statico. */
    js: string;
    /** I pezzi che si scaricano a richiesta, uno per `import()`. */
    aRichiesta: string[];
    esporta: string[];
}

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../${percorso}`, import.meta.url));
const gzip = (js: string) => gzipSync(js, { level: 9 }).length;
const volte = (testo: string, parte: string) => testo.split(parte).length - 1;
const inKb = (byte: number) => byte / 1024;
const scritture = (js: string, globale: string) => [...js.matchAll(new RegExp(`window\\.${globale}\\s*=(?!=)`, 'g'))].length;

function costruito(esito: Awaited<ReturnType<typeof build>>): Costruito {
    const pezzi = (Array.isArray(esito) ? esito : [esito]).flatMap((uscita) => ('output' in uscita ? uscita.output : [])).filter((pezzo) => pezzo.type === 'chunk');

    return {
        js: pezzi.filter((pezzo) => !pezzo.isDynamicEntry).map((pezzo) => pezzo.code).join('\n'),
        aRichiesta: pezzi.filter((pezzo) => pezzo.isDynamicEntry).map((pezzo) => pezzo.code),
        esporta: pezzi.flatMap((pezzo) => (pezzo.isEntry ? pezzo.exports : [])).sort(),
    };
}

/** Un'app di prova, costruita come la costruisce un frontend: minificata, con React fuori. */
async function app(file: string): Promise<Costruito> {
    return costruito(await build({ configFile: false, root: delRepo(''), logLevel: 'silent', plugins: [react()], build: { write: false, minify: true, rolldownOptions: { input: delRepo(file), external: FUORI } } }));
}

/** Un'app che non ha un file suo: importa quei file del repo, nell'ordine, e nient'altro. Costruita come le altre app di prova. */
async function appCheImporta(file: string[]): Promise<Costruito> {
    const nome = 'virtuale:ingresso';
    const senzaFile: Plugin = {
        name: 'zr-core:ingresso-senza-file',
        resolveId: (id) => (id === nome ? `\0${nome}` : null),
        load: (id) => (id === `\0${nome}` ? file.map((uno) => `import ${JSON.stringify(delRepo(uno))};`).join('\n') : null),
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

let soloCornice: Costruito;
let perNome: Costruito;
let diSempre: Costruito;
let ingressoPerLeApp: Costruito;
let ingressoDiSempre: Costruito;
let dalBundle: Costruito;
let dalModulo: Costruito;

// vitest gira con NODE_ENV=test, e così il plugin di React renderebbe il JSX come in sviluppo, più pesante: qui si costruisce
// come fa `vite build`, in produzione.
beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    soloCornice = await app('resources/demo/peso/cornice.ts');
    perNome = await app('resources/demo/peso/per-nome.ts');
    diSempre = await app('resources/demo/peso/oggi.ts');
    ingressoPerLeApp = await ingresso('resources/js/app.ts');
    ingressoDiSempre = await ingresso('resources/js/index.ts');
    dalBundle = await appCheImporta(DAL_BUNDLE);
    dalModulo = await appCheImporta(DAL_MODULO);
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

describe('le frasi delle notifiche non stanno nel JS d\'ingresso: sono pezzi a richiesta, uno per lingua (sprint 30 · T1.1, T1.2, T1.8)', () => {
    const app = [
        ['solo la cornice, dall\'ingresso per le app', () => soloCornice],
        ['la cornice e due componenti per nome', () => perNome],
        ['la stessa cornice, dall\'ingresso di sempre', () => diSempre],
    ] as const;

    it.each(app)('«%s»: nel JS d\'ingresso nessuna frase, di nessuna lingua', (_nome, costruita) => {
        expect(Object.values(FRASI).filter((frase) => costruita().js.includes(frase))).toStrictEqual([]);
    });

    it.each(app)('«%s»: tre pezzi a richiesta con le frasi, ognuno di una lingua sola; il quarto è dei rimedi di tastiera, senza frasi', (_nome, costruita) => {
        const lingueDeiPezzi = costruita().aRichiesta.map((pezzo) => Object.entries(FRASI).flatMap(([lingua, frase]) => (pezzo.includes(frase) ? [lingua] : [])));

        expect(lingueDeiPezzi.sort()).toStrictEqual([[], ['en'], ['es'], ['it']]);
    });

    it.each(app)('«%s»: i rimedi provvisori di tastiera stanno in un pezzo a richiesta solo, non nel JS d\'ingresso (sprint 30 · T3)', (_nome, costruita) => {
        expect(costruita().js).not.toContain(DEI_RIMEDI);
        expect(costruita().aRichiesta.filter((pezzo) => pezzo.includes(DEI_RIMEDI))).toHaveLength(1);
    });

    it('l\'app che prende solo la cornice pesa all\'ingresso, con gzip, al più 18 KB e 32 byte: i 32 sono dei rimedi provvisori di tastiera', () => {
        expect(gzip(soloCornice.js)).toBeLessThanOrEqual(TETTO_DELL_INGRESSO);
        expect(TETTO_DELL_INGRESSO).toBe(18_464);
    });

    // Chi mostra le notifiche in una pagina sua ha titoli e righe subito, senza aspettare niente: il pezzo che importa
    // `rigaDellaNotifica` porta le frasi di ogni lingua. I due ingressi del pacchetto la esportano, e costruiti da soli le hanno.
    it.each([
        ['per le app', () => ingressoPerLeApp],
        ['di sempre', () => ingressoDiSempre],
    ])('l\'ingresso %s, che esporta le funzioni per chi mostra le notifiche in una pagina sua, porta le frasi di ogni lingua', (_nome, costruito) => {
        expect(Object.values(FRASI).filter((frase) => !costruito().js.includes(frase))).toStrictEqual([]);
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
        expect(volte(ingressoDiSempre.js, 'Zeiras è davvero gratis?')).toBe(1);
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
